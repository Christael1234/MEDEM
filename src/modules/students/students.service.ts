import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GuardianRelationship, Stream, StreamChangeRequestStatus, StudentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AcademicSessionsService } from '../academic-sessions/academic-sessions.service';
import { AuditService } from '../audit/audit.service';
import { ClassesService } from '../classes/classes.service';
import { DEFAULT_PORTAL_PASSWORD, generateLoginEmail } from '../../common/auth/login-credentials';
import { NumberingService } from '../../common/numbering/numbering.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { BulkPromoteDto } from './dto/bulk-promote.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { PromoteStudentDto } from './dto/promote-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly classes: ClassesService,
    private readonly academicSessions: AcademicSessionsService,
    private readonly audit: AuditService,
    private readonly requestContext: RequestContextService,
  ) {}

  async create(dto: CreateStudentDto) {
    await this.prisma.db.campus.findUniqueOrThrow({ where: { id: dto.campusId } });
    if (dto.currentClassArmId) {
      await this.classes.assertArmBelongsToTenant(dto.currentClassArmId);
    }

    // At least one parent/guardian is required: either link an existing
    // one (found via GET /guardians?search=, e.g. a sibling's parent
    // already on file) or provide a new one's name. A second guardian is
    // optional either way. class-validator can't express "one of these
    // two field groups" cleanly, so it's checked here.
    if (!dto.guardianId && !(dto.guardianFirstName && dto.guardianLastName)) {
      throw new BadRequestException('A parent/guardian is required: search for an existing one or provide a name');
    }
    if (dto.secondGuardianFirstName || dto.secondGuardianLastName || dto.secondGuardianId) {
      if (!dto.secondGuardianRelationship) {
        throw new BadRequestException('secondGuardianRelationship is required when adding a second guardian');
      }
      if (!dto.secondGuardianId && !(dto.secondGuardianFirstName && dto.secondGuardianLastName)) {
        throw new BadRequestException('The second guardian needs a name, or search for an existing one');
      }
    }

    const tenantId = this.requestContext.getTenantId();
    if (!tenantId) throw new ForbiddenException();

    const admissionNo = await this.numbering.next('STUDENT_ID', 'STU-');
    const loginEmail = await generateLoginEmail(
      this.prisma,
      tenantId,
      dto.firstName,
      dto.lastName,
      'student',
    );
    const passwordHash = await bcrypt.hash(DEFAULT_PORTAL_PASSWORD, 12);

    // Login emails are generated up front (not inside the transaction):
    // generateLoginEmail does its own collision check via prisma.raw,
    // matching how the student's own email above is resolved before the
    // transaction starts. Only a *newly created* guardian gets a login;
    // reusing an existing guardianId never touches its account.
    const hasSecondGuardian = !!(dto.secondGuardianId || (dto.secondGuardianFirstName && dto.secondGuardianLastName));
    const guardian1Account = dto.guardianId
      ? null
      : { email: await generateLoginEmail(this.prisma, tenantId, dto.guardianFirstName!, dto.guardianLastName!, 'parent'), passwordHash: await bcrypt.hash(DEFAULT_PORTAL_PASSWORD, 12) };
    const guardian2Account = hasSecondGuardian && !dto.secondGuardianId
      ? { email: await generateLoginEmail(this.prisma, tenantId, dto.secondGuardianFirstName!, dto.secondGuardianLastName!, 'parent'), passwordHash: await bcrypt.hash(DEFAULT_PORTAL_PASSWORD, 12) }
      : null;

    const { student, user, guardianLinks, guardianAccounts } = await this.prisma.db.$transaction(async (tx) => {
      // User.tenantId is nullable at the schema level, so (unlike Student)
      // this doesn't need the tenantScopedCreate type-assertion trick: the
      // extension still injects tenantId at runtime.
      const user = await tx.user.create({
        data: {
          role: 'STUDENT',
          email: loginEmail,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });

      const student = await tx.student.create({
        data: tenantScopedCreate({
          campusId: dto.campusId,
          admissionNo,
          firstName: dto.firstName,
          lastName: dto.lastName,
          middleName: dto.middleName,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          gender: dto.gender,
          currentClassArmId: dto.currentClassArmId,
          status: dto.status ?? 'ACTIVE',
          userId: user.id,
        }),
      });

      // Resolves an existing guardian by id (tenant ownership confirmed by
      // the tenant-scoping extension, same as any other tx.guardian call)
      // or creates a new one, never both: id takes precedence. A newly
      // created guardian also gets a real portal login (account pre-built
      // above), same as the student itself.
      const resolveGuardian = async (opts: {
        id?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        account?: { email: string; passwordHash: string } | null;
      }) => {
        if (opts.id) return { guardian: await tx.guardian.findUniqueOrThrow({ where: { id: opts.id } }), loginCredentials: null as { email: string; password: string } | null };
        let userId: string | undefined;
        if (opts.account) {
          const guardianUser = await tx.user.create({
            data: { role: 'PARENT', email: opts.account.email, passwordHash: opts.account.passwordHash, firstName: opts.firstName!, lastName: opts.lastName! },
          });
          userId = guardianUser.id;
        }
        const guardian = await tx.guardian.create({
          data: tenantScopedCreate({ userId, firstName: opts.firstName!, lastName: opts.lastName!, email: opts.email, phone: opts.phone }),
        });
        return { guardian, loginCredentials: opts.account ? { email: opts.account.email, password: DEFAULT_PORTAL_PASSWORD } : null };
      };

      const guardianLinks: { guardianId: string; relationship: GuardianRelationship; isNew: boolean }[] = [];
      const guardianAccounts: { name: string; email: string; password: string }[] = [];

      const { guardian: guardian1, loginCredentials: guardian1Login } = await resolveGuardian({
        id: dto.guardianId,
        firstName: dto.guardianFirstName,
        lastName: dto.guardianLastName,
        email: dto.guardianEmail,
        phone: dto.guardianPhone,
        account: guardian1Account,
      });
      await tx.studentGuardian.create({
        data: { studentId: student.id, guardianId: guardian1.id, relationship: dto.guardianRelationship, isPrimary: true },
      });
      guardianLinks.push({ guardianId: guardian1.id, relationship: dto.guardianRelationship, isNew: !dto.guardianId });
      if (guardian1Login) guardianAccounts.push({ name: `${guardian1.firstName} ${guardian1.lastName}`, ...guardian1Login });

      if (hasSecondGuardian) {
        const { guardian: guardian2, loginCredentials: guardian2Login } = await resolveGuardian({
          id: dto.secondGuardianId,
          firstName: dto.secondGuardianFirstName,
          lastName: dto.secondGuardianLastName,
          email: dto.secondGuardianEmail,
          phone: dto.secondGuardianPhone,
          account: guardian2Account,
        });
        await tx.studentGuardian.create({
          data: { studentId: student.id, guardianId: guardian2.id, relationship: dto.secondGuardianRelationship!, isPrimary: false },
        });
        guardianLinks.push({ guardianId: guardian2.id, relationship: dto.secondGuardianRelationship!, isNew: !dto.secondGuardianId });
        if (guardian2Login) guardianAccounts.push({ name: `${guardian2.firstName} ${guardian2.lastName}`, ...guardian2Login });
      }

      return { student, user, guardianLinks, guardianAccounts };
    });

    await this.audit.log({
      action: 'STUDENT_CREATED',
      entityType: 'Student',
      entityId: student.id,
      after: { admissionNo: student.admissionNo, status: student.status, loginEmail: user.email, guardianLinks },
    });

    return {
      ...student,
      loginCredentials: { email: user.email, password: DEFAULT_PORTAL_PASSWORD },
      guardianLoginCredentials: guardianAccounts,
    };
  }

  async list(filter: { campusId?: string; classArmId?: string; status?: StudentStatus }) {
    const role = this.requestContext.getRole();

    if (role === 'STUDENT' || role === 'PARENT') {
      const allowedIds = await this.assignmentScopedStudentIds();
      return this.prisma.db.student.findMany({
        where: {
          id: { in: allowedIds },
          campusId: filter.campusId,
          currentClassArmId: filter.classArmId,
          status: filter.status,
        },
        orderBy: { lastName: 'asc' },
      });
    }

    if (role === 'TEACHER') {
      const allowedArmIds = await this.classes.listArmIdsForCurrentTeacher();
      if (filter.classArmId && !allowedArmIds.includes(filter.classArmId)) {
        throw new ForbiddenException('Teacher is not assigned to this class');
      }
      return this.prisma.db.student.findMany({
        where: {
          campusId: filter.campusId,
          currentClassArmId: filter.classArmId ?? { in: allowedArmIds },
          status: filter.status,
        },
        orderBy: { lastName: 'asc' },
      });
    }

    return this.prisma.db.student.findMany({
      where: {
        campusId: filter.campusId,
        currentClassArmId: filter.classArmId,
        status: filter.status,
      },
      orderBy: { lastName: 'asc' },
    });
  }

  async findOne(id: string) {
    const role = this.requestContext.getRole();
    if (role === 'STUDENT' || role === 'PARENT') {
      const allowedIds = await this.assignmentScopedStudentIds();
      if (!allowedIds.includes(id)) {
        throw new ForbiddenException('No access to this student record');
      }
    }
    if (role === 'TEACHER') {
      const student = await this.prisma.db.student.findUniqueOrThrow({
        where: { id },
        select: { currentClassArmId: true },
      });
      const allowedArmIds = await this.classes.listArmIdsForCurrentTeacher();
      if (!student.currentClassArmId || !allowedArmIds.includes(student.currentClassArmId)) {
        throw new ForbiddenException('No access to this student record');
      }
    }

    return this.prisma.db.student.findUniqueOrThrow({
      where: { id },
      include: {
        guardianLinks: { include: { guardian: true } },
        classHistory: true,
        currentClassArm: { include: { schoolClass: { select: { name: true, level: true } } } },
      },
    });
  }

  /** RBAC spec scope: PARENT sees only linked children, STUDENT sees only
   * their own record ("own child" / own-record assignment scope). Both
   * lookups stay within prisma.db so they're still tenant-scoped. Public
   * because Attendance/Results reuse it to scope their own list queries. */
  async assignmentScopedStudentIds(): Promise<string[]> {
    const role = this.requestContext.getRole();
    const userId = this.requestContext.getUserId();
    if (!userId) throw new NotFoundException();

    if (role === 'STUDENT') {
      const student = await this.prisma.db.student.findFirst({
        where: { userId },
        select: { id: true },
      });
      return student ? [student.id] : [];
    }

    const guardian = await this.prisma.db.guardian.findFirst({
      where: { userId },
      select: { studentLinks: { select: { studentId: true } } },
    });
    return guardian?.studentLinks.map((link) => link.studentId) ?? [];
  }

  /** Updates the student's own profile fields and, if a portal login is
   * linked, keeps the User's display name in sync: CLAUDE.md rule #5
   * treats name changes as a sensitive profile change, so it's audited. */
  async update(id: string, dto: UpdateStudentDto) {
    const before = await this.prisma.db.student.findUniqueOrThrow({ where: { id } });

    const student = await this.prisma.db.$transaction(async (tx) => {
      const updated = await tx.student.update({
        where: { id },
        data: {
          firstName: dto.firstName ?? undefined,
          lastName: dto.lastName ?? undefined,
          middleName: dto.middleName ?? undefined,
          gender: dto.gender ?? undefined,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        },
      });

      if (updated.userId && (dto.firstName || dto.lastName)) {
        await tx.user.update({
          where: { id: updated.userId },
          data: {
            firstName: dto.firstName ?? undefined,
            lastName: dto.lastName ?? undefined,
          },
        });
      }

      return updated;
    });

    await this.audit.log({
      action: 'STUDENT_UPDATED',
      entityType: 'Student',
      entityId: id,
      before: { firstName: before.firstName, lastName: before.lastName },
      after: { firstName: student.firstName, lastName: student.lastName },
    });

    return student;
  }

  async setPhoto(id: string, photoUrl: string) {
    const before = await this.prisma.db.student.findUniqueOrThrow({ where: { id } });
    const student = await this.prisma.db.student.update({ where: { id }, data: { photoUrl } });

    await this.audit.log({
      action: 'STUDENT_PHOTO_UPDATED',
      entityType: 'Student',
      entityId: id,
      before: { photoUrl: before.photoUrl },
      after: { photoUrl: student.photoUrl },
    });

    return student;
  }

  /** Science/Art stream is only meaningful once a student is actually in
   * Senior Secondary: gated the same way promotion is gated on Third
   * Term, rather than letting a Nursery student get tagged by mistake.
   * Sets the stream flag and, if the student's class has an arm tagged
   * for the new stream (ClassArm.stream), moves them into a random one of
   * those arms, recorded as StudentClassHistory, same "no silent
   * rewrite" discipline as promotion. Doesn't move them if the class has
   * no arm tagged for that stream yet (admin hasn't configured one);
   * the stream flag still gets set either way. */
  private async applyStreamChange(id: string, stream: Stream) {
    const student = await this.prisma.db.student.findUniqueOrThrow({
      where: { id },
      include: { currentClassArm: { include: { schoolClass: { include: { arms: true } } } } },
    });

    if (!student.currentClassArm || student.currentClassArm.schoolClass.level !== 'SENIOR_SECONDARY') {
      throw new BadRequestException('Stream can only be set for a student currently in a Senior Secondary class');
    }

    const before = { stream: student.stream, classArmId: student.currentClassArmId };
    const eligibleArms = student.currentClassArm.schoolClass.arms.filter((a) => a.stream === stream);
    const newArm = eligibleArms.length
      ? eligibleArms[Math.floor(Math.random() * eligibleArms.length)]
      : null;
    const movingArm = !!(newArm && newArm.id !== before.classArmId);
    const currentSession = movingArm ? await this.academicSessions.getCurrentSession() : null;

    const updated = await this.prisma.db.$transaction(async (tx) => {
      const s = await tx.student.update({
        where: { id },
        data: { stream, currentClassArmId: newArm ? newArm.id : undefined },
      });
      if (movingArm && newArm && currentSession) {
        await tx.studentClassHistory.create({
          data: { studentId: id, academicSessionId: currentSession.id, classArmId: newArm.id, reason: 'stream change' },
        });
      }
      return s;
    });

    return { before, student: updated };
  }

  /** Admin-direct stream set: no review needed, PROPRIETOR/PRINCIPAL
   * already have full authority over a student's record. Self-service
   * changes go through requestStreamChange/reviewStreamChangeRequest
   * instead (see those for why). */
  async setStream(id: string, stream: Stream) {
    const { before, student } = await this.applyStreamChange(id, stream);
    await this.audit.log({
      action: 'STUDENT_STREAM_SET',
      entityType: 'Student',
      entityId: id,
      before,
      after: { stream: student.stream, classArmId: student.currentClassArmId },
    });
    return student;
  }

  /** Self-service: only a student in their FIRST Senior Secondary class
   * (ClassesService.isEntrySeniorSecondaryClass, "SS1") may request a
   * switch, and only ever as a request: it takes an admin's approval to
   * actually change anything, same as it takes an admin to approve a
   * result before it's official. One pending request per student at a
   * time. */
  async requestStreamChange(studentId: string, requestedStream: Stream, reason?: string) {
    const student = await this.prisma.db.student.findUniqueOrThrow({
      where: { id: studentId },
      include: { currentClassArm: { include: { schoolClass: { select: { id: true, level: true } } } } },
    });
    if (!student.currentClassArm || student.currentClassArm.schoolClass.level !== 'SENIOR_SECONDARY') {
      throw new BadRequestException('Stream requests are only available to Senior Secondary students');
    }
    const isEntry = await this.classes.isEntrySeniorSecondaryClass(student.currentClassArm.schoolClass.id);
    if (!isEntry) {
      throw new ForbiddenException('Only SS1 students may request a stream change');
    }
    if (student.stream === requestedStream) {
      throw new BadRequestException(`Already in the ${requestedStream} stream`);
    }
    const existing = await this.prisma.db.streamChangeRequest.findFirst({
      where: { studentId, status: 'PENDING' },
    });
    if (existing) {
      throw new ConflictException('A stream change request is already pending review');
    }

    const request = await this.prisma.db.streamChangeRequest.create({
      data: tenantScopedCreate({ studentId, requestedStream, reason }),
    });

    await this.audit.log({
      action: 'STREAM_CHANGE_REQUESTED',
      entityType: 'StreamChangeRequest',
      entityId: request.id,
      after: { studentId, requestedStream, reason },
    });

    return request;
  }

  /** Admin queue (no studentId filter) or a student's own history (via
   * StudentPortalController, which always passes their own id): same
   * query, scoped differently by the caller. */
  listStreamChangeRequests(status?: StreamChangeRequestStatus, studentId?: string) {
    return this.prisma.db.streamChangeRequest.findMany({
      where: { status, studentId },
      orderBy: { createdAt: 'desc' },
      include: { student: { select: { firstName: true, lastName: true, admissionNo: true, stream: true } } },
    });
  }

  async reviewStreamChangeRequest(id: string, approve: boolean, reviewNote?: string) {
    const request = await this.prisma.db.streamChangeRequest.findUniqueOrThrow({ where: { id } });
    if (request.status !== 'PENDING') {
      throw new BadRequestException('This request has already been reviewed');
    }
    const userId = this.requestContext.getUserId();

    if (!approve) {
      const rejected = await this.prisma.db.streamChangeRequest.update({
        where: { id },
        data: { status: 'REJECTED', reviewedByUserId: userId ?? undefined, reviewNote, reviewedAt: new Date() },
      });
      await this.audit.log({
        action: 'STREAM_CHANGE_REQUEST_REJECTED',
        entityType: 'StreamChangeRequest',
        entityId: id,
        after: { reviewNote },
      });
      return rejected;
    }

    const { before, student } = await this.applyStreamChange(request.studentId, request.requestedStream);
    await this.prisma.db.streamChangeRequest.update({
      where: { id },
      data: { status: 'APPROVED', reviewedByUserId: userId ?? undefined, reviewNote, reviewedAt: new Date() },
    });

    await this.audit.log({
      action: 'STREAM_CHANGE_REQUEST_APPROVED',
      entityType: 'StreamChangeRequest',
      entityId: id,
      before,
      after: { stream: student.stream, classArmId: student.currentClassArmId },
    });

    return this.prisma.db.streamChangeRequest.findUniqueOrThrow({ where: { id } });
  }

  /** Senior Secondary subject picker options: compulsory subjects (every
   * student gets these automatically), core trade subjects (exactly one
   * required), and electives split by stream — a student only ever sees
   * the elective list matching their own Student.stream. */
  async getSubjectOptions() {
    const [compulsory, coreTrade, scienceElectives, artElectives] = await Promise.all([
      this.prisma.db.subject.findMany({ where: { gradeTiers: { has: 'SENIOR_SECONDARY' }, isCompulsory: true }, orderBy: { name: 'asc' } }),
      this.prisma.db.subject.findMany({ where: { gradeTiers: { has: 'SENIOR_SECONDARY' }, isCoreTrade: true }, orderBy: { name: 'asc' } }),
      this.prisma.db.subject.findMany({ where: { gradeTiers: { has: 'SENIOR_SECONDARY' }, isCompulsory: false, isCoreTrade: false, streams: { has: 'SCIENCE' } }, orderBy: { name: 'asc' } }),
      this.prisma.db.subject.findMany({ where: { gradeTiers: { has: 'SENIOR_SECONDARY' }, isCompulsory: false, isCoreTrade: false, streams: { has: 'ART' } }, orderBy: { name: 'asc' } }),
    ]);
    return { compulsory, coreTrade, electives: { SCIENCE: scienceElectives, ART: artElectives } };
  }

  getSubjectSelection(studentId: string, academicSessionId: string) {
    return this.prisma.db.studentSubjectSelection.findMany({
      where: { studentId, academicSessionId },
      include: { subject: true },
      orderBy: { subject: { name: 'asc' } },
    });
  }

  /** Replaces a student's whole Senior Secondary subject selection for a
   * session in one transaction (delete-then-recreate, not an append) —
   * same "explicit re-selection, not silent drift" discipline as
   * setStream. Compulsory subjects are computed and included
   * automatically; the trade subject and electives are validated against
   * Student.stream and the subject's isCompulsory/isCoreTrade/streams
   * tags. Total (compulsory + trade + electives) must land on 8 or 9. */
  async setSubjectSelection(studentId: string, academicSessionId: string, tradeSubjectId: string, electiveSubjectIds: string[]) {
    const student = await this.prisma.db.student.findUniqueOrThrow({
      where: { id: studentId },
      include: { currentClassArm: { include: { schoolClass: { select: { level: true } } } } },
    });
    if (!student.currentClassArm || student.currentClassArm.schoolClass.level !== 'SENIOR_SECONDARY') {
      throw new BadRequestException('Subject selection is only available to Senior Secondary students');
    }
    if (!student.stream) {
      throw new BadRequestException('Set your stream before selecting subjects');
    }

    const uniqueElectiveIds = [...new Set(electiveSubjectIds)];
    if (uniqueElectiveIds.length !== electiveSubjectIds.length) {
      throw new BadRequestException('Duplicate subject in your elective selection');
    }

    const [compulsory, tradeSubject, electiveSubjects] = await Promise.all([
      this.prisma.db.subject.findMany({ where: { gradeTiers: { has: 'SENIOR_SECONDARY' }, isCompulsory: true } }),
      this.prisma.db.subject.findUniqueOrThrow({ where: { id: tradeSubjectId } }),
      this.prisma.db.subject.findMany({ where: { id: { in: uniqueElectiveIds } } }),
    ]);

    if (!tradeSubject.isCoreTrade) {
      throw new BadRequestException(`${tradeSubject.name} isn't a core trade subject`);
    }
    if (electiveSubjects.length !== uniqueElectiveIds.length) {
      throw new BadRequestException('One or more selected subjects could not be found');
    }
    const invalidElective = electiveSubjects.find((s) => !s.streams.includes(student.stream!));
    if (invalidElective) {
      throw new BadRequestException(`${invalidElective.name} isn't offered in your stream`);
    }

    const subjectIds = [...new Set([...compulsory.map((s) => s.id), tradeSubject.id, ...uniqueElectiveIds])];
    if (subjectIds.length < 8 || subjectIds.length > 9) {
      throw new BadRequestException(`Total subjects must be 8 or 9 (you have ${subjectIds.length})`);
    }

    const before = await this.getSubjectSelection(studentId, academicSessionId);

    await this.prisma.db.$transaction(async (tx) => {
      await tx.studentSubjectSelection.deleteMany({ where: { studentId, academicSessionId } });
      await tx.studentSubjectSelection.createMany({
        data: subjectIds.map((subjectId) => tenantScopedCreate({ studentId, subjectId, academicSessionId })),
      });
    });

    const after = await this.getSubjectSelection(studentId, academicSessionId);

    await this.audit.log({
      action: 'STUDENT_SUBJECT_SELECTION_SET',
      entityType: 'Student',
      entityId: studentId,
      before: { subjects: before.map((b) => b.subject.name) },
      after: { subjects: after.map((a) => a.subject.name) },
    });

    return after;
  }

  async updateStatus(id: string, status: StudentStatus) {
    const before = await this.prisma.db.student.findUniqueOrThrow({ where: { id } });
    const student = await this.prisma.db.student.update({ where: { id }, data: { status } });

    await this.audit.log({
      action: 'STUDENT_STATUS_CHANGED',
      entityType: 'Student',
      entityId: id,
      before: { status: before.status },
      after: { status: student.status },
    });

    return student;
  }

  /** Promotion/transfer: records StudentClassHistory and moves the
   * student's currentClassArmId: CLAUDE.md treats this as an audited
   * trail, not a silent field overwrite. */
  async promote(id: string, dto: PromoteStudentDto) {
    await this.classes.assertArmBelongsToTenant(dto.classArmId);
    await this.prisma.db.academicSession.findUniqueOrThrow({
      where: { id: dto.academicSessionId },
    });

    const before = await this.prisma.db.student.findUniqueOrThrow({ where: { id } });

    const [student] = await this.prisma.db.$transaction([
      this.prisma.db.student.update({
        where: { id },
        data: { currentClassArmId: dto.classArmId },
      }),
      this.prisma.db.studentClassHistory.create({
        data: {
          studentId: id,
          academicSessionId: dto.academicSessionId,
          classArmId: dto.classArmId,
          reason: dto.reason ?? 'promotion',
        },
      }),
    ]);

    await this.audit.log({
      action: 'STUDENT_PROMOTED',
      entityType: 'Student',
      entityId: id,
      before: { classArmId: before.currentClassArmId },
      after: { classArmId: dto.classArmId, reason: dto.reason ?? 'promotion' },
    });

    return student;
  }

  /** End-of-session bulk promotion review: only runnable in Third Term
   * (assertCurrentTermIsThird). Returns every ACTIVE student currently in
   * the arm plus a proposed target (the same-named arm in
   * SchoolClass.promotesToClass, if the admin set one up and a
   * same-named arm exists there) so the admin reviews/adjusts before
   * confirming rather than a blind one-click promote. A class with no
   * promotesToClass is terminal; its students graduate instead. */
  async previewPromotion(classArmId: string, targetAcademicSessionId: string) {
    await this.academicSessions.assertCurrentTermIsThird();
    await this.classes.assertArmBelongsToTenant(classArmId);
    await this.prisma.db.academicSession.findUniqueOrThrow({ where: { id: targetAcademicSessionId } });

    const arm = await this.prisma.db.classArm.findUniqueOrThrow({
      where: { id: classArmId },
      include: { schoolClass: { include: { promotesToClass: { include: { arms: true } } } } },
    });

    const students = await this.prisma.db.student.findMany({
      where: { currentClassArmId: classArmId, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, admissionNo: true },
      orderBy: { lastName: 'asc' },
    });

    const targetClass = arm.schoolClass.promotesToClass;
    const targetArms = targetClass ? targetClass.arms.map((a) => ({ id: a.id, name: a.name })) : [];
    const defaultTargetArmId = targetClass ? (targetClass.arms.find((a) => a.name === arm.name)?.id ?? null) : null;

    return {
      sourceClassArm: { id: arm.id, name: arm.name, schoolClassName: arm.schoolClass.name },
      targetClass: targetClass ? { id: targetClass.id, name: targetClass.name } : null,
      targetArms,
      isGraduating: !targetClass,
      students: students.map((s) => ({ ...s, defaultTargetClassArmId: defaultTargetArmId })),
    };
  }

  /** Applies a reviewed promotion list. Each assignment with a
   * targetClassArmId moves that student (StudentClassHistory + a
   * currentClassArmId update, same write shape as promote()); one
   * without graduates the student instead (status -> GRADUATED; there's
   * no class to record history against). Looped and individually
   * audited/error-checked rather than one giant transaction, same
   * "bulk = many audited single writes" shape as the CBT/results
   * bulk-approve action. */
  async bulkPromote(dto: BulkPromoteDto) {
    await this.academicSessions.assertCurrentTermIsThird();
    await this.classes.assertArmBelongsToTenant(dto.classArmId);
    await this.prisma.db.academicSession.findUniqueOrThrow({ where: { id: dto.targetAcademicSessionId } });

    const targetArmIds = [...new Set(dto.assignments.map((a) => a.targetClassArmId).filter((x): x is string => !!x))];
    for (const armId of targetArmIds) {
      await this.classes.assertArmBelongsToTenant(armId);
    }

    const studentIds = dto.assignments.map((a) => a.studentId);
    const students = await this.prisma.db.student.findMany({
      where: { id: { in: studentIds }, currentClassArmId: dto.classArmId },
      select: { id: true, currentClassArmId: true },
    });
    if (students.length !== studentIds.length) {
      throw new BadRequestException('One or more students are not currently in this class arm');
    }
    const byId = new Map(students.map((s) => [s.id, s]));

    let promoted = 0;
    let graduated = 0;
    for (const assignment of dto.assignments) {
      const before = byId.get(assignment.studentId)!;
      if (assignment.targetClassArmId) {
        await this.prisma.db.$transaction([
          this.prisma.db.student.update({
            where: { id: assignment.studentId },
            data: { currentClassArmId: assignment.targetClassArmId },
          }),
          this.prisma.db.studentClassHistory.create({
            data: {
              studentId: assignment.studentId,
              academicSessionId: dto.targetAcademicSessionId,
              classArmId: assignment.targetClassArmId,
              reason: 'promotion',
            },
          }),
        ]);
        await this.audit.log({
          action: 'STUDENT_PROMOTED',
          entityType: 'Student',
          entityId: assignment.studentId,
          before: { classArmId: before.currentClassArmId },
          after: { classArmId: assignment.targetClassArmId, reason: 'promotion' },
        });
        promoted += 1;
      } else {
        await this.prisma.db.student.update({
          where: { id: assignment.studentId },
          data: { status: 'GRADUATED' },
        });
        await this.audit.log({
          action: 'STUDENT_GRADUATED',
          entityType: 'Student',
          entityId: assignment.studentId,
          before: { classArmId: before.currentClassArmId, status: 'ACTIVE' },
          after: { status: 'GRADUATED' },
        });
        graduated += 1;
      }
    }

    return { promoted, graduated };
  }

  /** Mid-term data migration: each row is resolved (campus/class/arm
   * looked up by name, since a spreadsheet from another system has no
   * idea what our ids are) and then run through the exact same create()
   * used by the single "+ Add student" flow — same numbering sequence,
   * same login-account creation, same audit trail — so a bulk-imported
   * student is indistinguishable from one added by hand. Each row is
   * independent: one bad row (unknown class, missing guardian, etc.)
   * fails on its own and the rest of the batch still goes through. */
  async bulkImport(rows: Array<{
    firstName: string; lastName: string; middleName?: string; dateOfBirth?: string; gender?: string;
    campusName: string; className?: string; armName?: string;
    guardianFirstName: string; guardianLastName: string; guardianEmail?: string; guardianPhone?: string;
    guardianRelationship?: GuardianRelationship;
  }>) {
    const [campuses, classes] = await Promise.all([
      this.prisma.db.campus.findMany(),
      this.prisma.db.schoolClass.findMany({ include: { arms: true } }),
    ]);
    const campusByName = new Map(campuses.map((c) => [c.name.trim().toLowerCase(), c]));
    const classByName = new Map(classes.map((c) => [c.name.trim().toLowerCase(), c]));

    const results: Array<{ row: number; success: boolean; admissionNo?: string; studentId?: string; error?: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const campus = campusByName.get(row.campusName.trim().toLowerCase());
        if (!campus) throw new Error(`Unknown campus "${row.campusName}"`);

        let currentClassArmId: string | undefined;
        if (row.className) {
          const schoolClass = classByName.get(row.className.trim().toLowerCase());
          if (!schoolClass) throw new Error(`Unknown class "${row.className}"`);
          if (row.armName) {
            const arm = schoolClass.arms.find((a) => a.name.trim().toLowerCase() === row.armName!.trim().toLowerCase());
            if (!arm) throw new Error(`Unknown arm "${row.armName}" in class "${row.className}"`);
            currentClassArmId = arm.id;
          }
        }

        const created = await this.create({
          campusId: campus.id,
          firstName: row.firstName,
          lastName: row.lastName,
          middleName: row.middleName,
          dateOfBirth: row.dateOfBirth,
          gender: row.gender,
          currentClassArmId,
          guardianFirstName: row.guardianFirstName,
          guardianLastName: row.guardianLastName,
          guardianEmail: row.guardianEmail,
          guardianPhone: row.guardianPhone,
          guardianRelationship: row.guardianRelationship || 'OTHER',
        });
        results.push({ row: i + 1, success: true, admissionNo: created.admissionNo, studentId: created.id });
      } catch (err) {
        results.push({ row: i + 1, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    await this.audit.log({
      action: 'STUDENTS_BULK_IMPORTED',
      entityType: 'Student',
      entityId: 'bulk',
      after: { totalRows: rows.length, successCount, failureCount: rows.length - successCount },
    });

    return { totalRows: rows.length, successCount, failureCount: rows.length - successCount, results };
  }

  /** The last 20 bulk-import runs for this tenant, read straight back
   * off the audit trail bulkImport() writes to rather than a second,
   * separate history table to keep in sync. Uses prisma.raw + an
   * explicit tenantId filter (not prisma.db): AuditLog.tenantId is
   * nullable for platform-level actions, so the tenant-scoping
   * extension doesn't auto-scope it (see AuditService's own doc
   * comment). */
  async bulkImportHistory() {
    const tenantId = this.requestContext.getTenantId();
    const logs = await this.prisma.raw.auditLog.findMany({
      where: { tenantId, action: 'STUDENTS_BULK_IMPORTED' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return logs.map((l) => ({
      date: l.createdAt,
      ...(l.after as { totalRows: number; successCount: number; failureCount: number }),
    }));
  }
}
