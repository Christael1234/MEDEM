import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { ClassesService } from '../classes/classes.service';
import { DEFAULT_PORTAL_PASSWORD, generateLoginEmail } from '../../common/auth/login-credentials';
import { NumberingService } from '../../common/numbering/numbering.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { sanitizeUser } from '../../common/utils/sanitize-user';
import { CreateStaffProfileDto } from './dto/create-staff-profile.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

@Injectable()
export class StaffProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
    private readonly requestContext: RequestContextService,
  ) {}

  async create(dto: CreateStaffProfileDto) {
    await this.prisma.db.user.findUniqueOrThrow({ where: { id: dto.userId } });
    await this.prisma.db.campus.findUniqueOrThrow({ where: { id: dto.campusId } });

    const staffId = await this.numbering.next('STAFF_ID', 'STF-');

    return this.prisma.db.staffProfile.create({
      data: tenantScopedCreate({
        userId: dto.userId,
        campusId: dto.campusId,
        staffId,
        employmentType: dto.employmentType,
        department: dto.department,
        position: dto.position,
        dateJoined: dto.dateJoined ? new Date(dto.dateJoined) : undefined,
      }),
    });
  }

  /** Creates the User (role TEACHER, auto-generated login) and StaffProfile
   * together in one transaction — same pattern as StudentsService.create,
   * so a Proprietor/Principal adding a teacher gets a working login on the
   * spot instead of a separate account-provisioning step. */
  async createTeacher(dto: CreateTeacherDto) {
    await this.prisma.db.campus.findUniqueOrThrow({ where: { id: dto.campusId } });

    // ClassArm isn't auto-tenant-scoped (see tenant-scoping.extension.ts),
    // so tenant ownership has to be checked explicitly before trusting it
    // — a cross-tenant classArmId must never be assignable here (rule #1).
    // The campus match is a domain rule, not a security one: a class
    // teacher should actually be based at the campus their class is on.
    if (dto.classArmId) {
      await this.classes.assertArmBelongsToTenant(dto.classArmId);
      const arm = await this.prisma.db.classArm.findUniqueOrThrow({
        where: { id: dto.classArmId },
        select: { classTeacherId: true, schoolClass: { select: { campusId: true } } },
      });
      if (arm.classTeacherId) {
        throw new ConflictException('This class already has a class teacher assigned');
      }
      if (arm.schoolClass.campusId !== dto.campusId) {
        throw new BadRequestException('A class teacher must be assigned to a class at their own campus');
      }
    }

    const tenantId = this.requestContext.getTenantId();
    if (!tenantId) throw new ForbiddenException();

    const loginEmail = await generateLoginEmail(
      this.prisma,
      tenantId,
      dto.firstName,
      dto.lastName,
      'teacher',
    );
    const passwordHash = await bcrypt.hash(DEFAULT_PORTAL_PASSWORD, 12);
    const staffId = await this.numbering.next('STAFF_ID', 'STF-');

    const { staffProfile, user } = await this.prisma.db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          role: 'TEACHER',
          email: loginEmail,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });

      const staffProfile = await tx.staffProfile.create({
        data: tenantScopedCreate({
          userId: user.id,
          campusId: dto.campusId,
          staffId,
          employmentType: dto.employmentType ?? 'full_time',
          department: dto.department ?? 'Academics',
          position: dto.position ?? 'Teacher',
          dateJoined: dto.dateJoined ? new Date(dto.dateJoined) : undefined,
        }),
      });

      // Conditional update (classTeacherId: null in the where clause) makes
      // this atomic against a concurrent request assigning the same arm —
      // the earlier read-then-check above is just a fast-fail, not the
      // actual guarantee. count === 0 means someone else won the race.
      if (dto.classArmId) {
        const result = await tx.classArm.updateMany({
          where: { id: dto.classArmId, classTeacherId: null },
          data: { classTeacherId: staffProfile.id },
        });
        if (result.count === 0) {
          throw new ConflictException('This class already has a class teacher assigned');
        }
      }

      return { staffProfile, user };
    });

    await this.audit.log({
      action: 'TEACHER_CREATED',
      entityType: 'StaffProfile',
      entityId: staffProfile.id,
      after: { staffId: staffProfile.staffId, loginEmail: user.email, classArmId: dto.classArmId ?? null },
    });

    return {
      ...staffProfile,
      classArmId: dto.classArmId ?? null,
      loginCredentials: { email: user.email, password: DEFAULT_PORTAL_PASSWORD },
    };
  }

  async list(campusId?: string) {
    const staff = await this.prisma.db.staffProfile.findMany({
      where: campusId ? { campusId } : undefined,
      include: { user: true },
    });
    // user: true pulls passwordHash/mfaSecret off the row — never let
    // those reach the client (same rule sanitizeUser enforces elsewhere).
    return staff.map((s) => ({ ...s, user: sanitizeUser(s.user) }));
  }

  findByUserId(userId: string) {
    return this.prisma.db.staffProfile.findUniqueOrThrow({ where: { userId } });
  }

  async getOne(id: string) {
    const staffProfile = await this.prisma.db.staffProfile.findUniqueOrThrow({
      where: { id },
      include: {
        user: true,
        classArmsLed: { include: { schoolClass: { select: { name: true } } } },
        teacherAssignments: { include: { subject: true, schoolClass: true } },
      },
    });
    return { ...staffProfile, user: sanitizeUser(staffProfile.user) };
  }

  /** Updates the teacher's display name (lives on the linked User) and/or
   * their staff record fields together — CLAUDE.md rule #5 treats name
   * changes as a sensitive profile change, so both writes are audited. */
  async update(id: string, dto: UpdateTeacherDto) {
    const staffProfile = await this.prisma.db.staffProfile.findUniqueOrThrow({ where: { id } });
    const beforeUser = await this.prisma.db.user.findUniqueOrThrow({
      where: { id: staffProfile.userId },
    });

    const [updatedProfile, updatedUser] = await this.prisma.db.$transaction([
      this.prisma.db.staffProfile.update({
        where: { id },
        data: {
          department: dto.department ?? undefined,
          position: dto.position ?? undefined,
          employmentType: dto.employmentType ?? undefined,
        },
      }),
      this.prisma.db.user.update({
        where: { id: staffProfile.userId },
        data: {
          firstName: dto.firstName ?? undefined,
          lastName: dto.lastName ?? undefined,
        },
      }),
    ]);

    await this.audit.log({
      action: 'TEACHER_UPDATED',
      entityType: 'StaffProfile',
      entityId: id,
      before: {
        firstName: beforeUser.firstName,
        lastName: beforeUser.lastName,
        department: staffProfile.department,
        position: staffProfile.position,
      },
      after: {
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        department: updatedProfile.department,
        position: updatedProfile.position,
      },
    });

    return { ...updatedProfile, user: sanitizeUser(updatedUser) };
  }
}
