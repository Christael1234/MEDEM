import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { StudentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { ClassesService } from '../classes/classes.service';
import { DEFAULT_PORTAL_PASSWORD, generateLoginEmail } from '../../common/auth/login-credentials';
import { NumberingService } from '../../common/numbering/numbering.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { CreateStudentDto } from './dto/create-student.dto';
import { PromoteStudentDto } from './dto/promote-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly classes: ClassesService,
    private readonly audit: AuditService,
    private readonly requestContext: RequestContextService,
  ) {}

  async create(dto: CreateStudentDto) {
    await this.prisma.db.campus.findUniqueOrThrow({ where: { id: dto.campusId } });
    if (dto.currentClassArmId) {
      await this.classes.assertArmBelongsToTenant(dto.currentClassArmId);
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

    const { student, user } = await this.prisma.db.$transaction(async (tx) => {
      // User.tenantId is nullable at the schema level, so (unlike Student)
      // this doesn't need the tenantScopedCreate type-assertion trick — the
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

      return { student, user };
    });

    await this.audit.log({
      action: 'STUDENT_CREATED',
      entityType: 'Student',
      entityId: student.id,
      after: { admissionNo: student.admissionNo, status: student.status, loginEmail: user.email },
    });

    return {
      ...student,
      loginCredentials: { email: user.email, password: DEFAULT_PORTAL_PASSWORD },
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
        currentClassArm: { include: { schoolClass: { select: { name: true } } } },
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
   * linked, keeps the User's display name in sync — CLAUDE.md rule #5
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
   * student's currentClassArmId — CLAUDE.md treats this as an audited
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
}
