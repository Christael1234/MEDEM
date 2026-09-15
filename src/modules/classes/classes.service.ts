import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { RequestContextService } from '../../common/context/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { levelForGradeTier } from '../../common/grade-tier';
import { CreateClassArmDto } from './dto/create-class-arm.dto';
import { CreateSchoolClassDto } from './dto/create-school-class.dto';
import { UpdateClassArmDto } from './dto/update-class-arm.dto';
import { UpdateSchoolClassDto } from './dto/update-school-class.dto';

@Injectable()
export class ClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly audit: AuditService,
  ) {}

  async createClass(dto: CreateSchoolClassDto) {
    // Campus is tenant-scoped: resolving it first confirms campusId
    // belongs to the caller's own tenant before SchoolClass references it.
    await this.prisma.db.campus.findUniqueOrThrow({ where: { id: dto.campusId } });

    return this.prisma.db.schoolClass.create({
      data: tenantScopedCreate({
        campusId: dto.campusId,
        name: dto.name,
        gradeTier: dto.gradeTier,
        level: levelForGradeTier(dto.gradeTier),
        order: dto.order ?? 0,
      }),
    });
  }

  listClasses(campusId?: string) {
    return this.prisma.db.schoolClass.findMany({
      where: campusId ? { campusId } : undefined,
      orderBy: [{ level: 'asc' }, { order: 'asc' }],
      include: { arms: true, promotesToClass: { select: { id: true, name: true } } },
    });
  }

  getClass(id: string) {
    return this.prisma.db.schoolClass.findUniqueOrThrow({
      where: { id },
      include: {
        arms: {
          include: {
            classTeacher: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
        promotesToClass: { select: { id: true, name: true } },
        teacherAssignments: {
          include: {
            subject: true,
            staffProfile: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });
  }

  async updateClass(id: string, dto: UpdateSchoolClassDto) {
    const before = await this.prisma.db.schoolClass.findUniqueOrThrow({ where: { id } });

    if (dto.promotesToClassId) {
      if (dto.promotesToClassId === id) {
        throw new BadRequestException('A class cannot promote into itself');
      }
      await this.prisma.db.schoolClass.findUniqueOrThrow({ where: { id: dto.promotesToClassId } });
    }

    const updated = await this.prisma.db.schoolClass.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        gradeTier: dto.gradeTier ?? undefined,
        level: dto.gradeTier ? levelForGradeTier(dto.gradeTier) : undefined,
        order: dto.order ?? undefined,
        promotesToClassId: dto.clearPromotesTo ? null : (dto.promotesToClassId ?? undefined),
      },
    });

    await this.audit.log({
      action: 'CLASS_UPDATED',
      entityType: 'SchoolClass',
      entityId: id,
      before: { name: before.name, gradeTier: before.gradeTier, promotesToClassId: before.promotesToClassId },
      after: { name: updated.name, gradeTier: updated.gradeTier, promotesToClassId: updated.promotesToClassId },
    });

    return updated;
  }

  async createArm(dto: CreateClassArmDto) {
    await this.prisma.db.schoolClass.findUniqueOrThrow({ where: { id: dto.schoolClassId } });

    return this.prisma.db.classArm.create({
      data: {
        schoolClassId: dto.schoolClassId,
        name: dto.name,
        classTeacherId: dto.classTeacherId,
        stream: dto.stream,
      },
    });
  }

  async listArms(schoolClassId: string) {
    await this.prisma.db.schoolClass.findUniqueOrThrow({ where: { id: schoolClassId } });
    return this.prisma.db.classArm.findMany({ where: { schoolClassId } });
  }

  /** ClassArm and StaffProfile aren't auto-tenant-scoped (see the
   * extension's doc comment), so both are resolved through their
   * tenant-scoped parent (assertArmBelongsToTenant, and StaffProfile
   * itself which IS scoped) before the write, same pattern as
   * createArm/assertTeacherCanActOnArm. Covers both reassigning
   * (classTeacherId) and unassigning (removeClassTeacher) an existing
   * class teacher: StaffProfilesService.createTeacher covers the
   * assign-at-creation path; this is the only other place it can change. */
  async updateArm(id: string, dto: UpdateClassArmDto) {
    await this.assertArmBelongsToTenant(id);

    const before = await this.prisma.db.classArm.findUniqueOrThrow({
      where: { id },
      include: { schoolClass: { select: { campusId: true } } },
    });

    if (dto.classTeacherId) {
      const staffProfile = await this.prisma.db.staffProfile.findUniqueOrThrow({
        where: { id: dto.classTeacherId },
        select: { campusId: true },
      });
      if (staffProfile.campusId !== before.schoolClass.campusId) {
        throw new BadRequestException('A class teacher must be assigned to a class at their own campus');
      }
    }

    // A teacher leads exactly one arm at a time: reassigning them here
    // clears classTeacherId on whatever other arm(s) they were class
    // teacher of, rather than leaving them attached to both.
    if (dto.classTeacherId) {
      await this.prisma.db.classArm.updateMany({
        where: { classTeacherId: dto.classTeacherId, id: { not: id } },
        data: { classTeacherId: null },
      });
    }
    const updated = await this.prisma.db.classArm.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        classTeacherId: dto.removeClassTeacher ? null : (dto.classTeacherId ?? undefined),
        stream: dto.clearStream ? null : (dto.stream ?? undefined),
      },
    });

    await this.audit.log({
      action: 'CLASS_ARM_UPDATED',
      entityType: 'ClassArm',
      entityId: id,
      before: { name: before.name, classTeacherId: before.classTeacherId, stream: before.stream },
      after: { name: updated.name, classTeacherId: updated.classTeacherId, stream: updated.stream },
    });

    return updated;
  }

  /** ClassArm has no tenantId column of its own. Querying its parent
   * SchoolClass (which IS tenant-scoped) with a relation filter on
   * `arms` confirms the arm belongs to the caller's tenant without ever
   * trusting a client-supplied tenantId. */
  async assertArmBelongsToTenant(classArmId: string): Promise<void> {
    await this.prisma.db.schoolClass.findFirstOrThrow({
      where: { arms: { some: { id: classArmId } } },
    });
  }

  /** "SS1" isn't a magic label anywhere in the schema: it's whichever
   * SENIOR_SECONDARY class has no other SENIOR_SECONDARY class promoting
   * into it (promotesToClassId), using the same promotion chain the
   * bulk-promotion feature already relies on rather than a second,
   * separately-maintained "is this the entry class" flag. A class fed
   * only from JUNIOR_SECONDARY (or with no incoming promotion at all)
   * still counts as the entry point. Backs StudentsService's rule that
   * only a student's first Senior Secondary class may request a stream
   * switch. */
  async isEntrySeniorSecondaryClass(schoolClassId: string): Promise<boolean> {
    const cls = await this.prisma.db.schoolClass.findUniqueOrThrow({
      where: { id: schoolClassId },
      select: { level: true, promotedFromClasses: { select: { level: true } } },
    });
    if (cls.level !== 'SENIOR_SECONDARY') return false;
    return !cls.promotedFromClasses.some((p) => p.level === 'SENIOR_SECONDARY');
  }

  /** Build order steps 9-10: attendance/results creation is "scoped to
   * teacher's assigned classes". A TEACHER may act on a class arm only as
   * its class teacher (ClassArm.classTeacherId) or via a
   * TeacherSubjectAssignment row for that class. Every other role that
   * reaches here already cleared @Roles(), so this is a no-op for them. */
  async assertTeacherCanActOnArm(classArmId: string): Promise<void> {
    if (this.requestContext.getRole() !== 'TEACHER') return;

    const userId = this.requestContext.getUserId();
    const staffProfile = await this.prisma.db.staffProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!staffProfile) {
      throw new ForbiddenException('No staff profile linked to this account');
    }

    const schoolClass = await this.prisma.db.schoolClass.findFirstOrThrow({
      where: { arms: { some: { id: classArmId } } },
      select: { id: true, arms: { where: { id: classArmId }, select: { classTeacherId: true } } },
    });

    if (schoolClass.arms[0]?.classTeacherId === staffProfile.id) return;

    const assignment = await this.prisma.db.teacherSubjectAssignment.findFirst({
      where: { staffProfileId: staffProfile.id, schoolClassId: schoolClass.id },
    });
    if (!assignment) {
      throw new ForbiddenException('Teacher is not assigned to this class');
    }
  }

  /** Attendance is restricted to the class teacher only: unlike results/
   * lessons/assignments/CBT (assertTeacherCanActOnArm), a subject teacher
   * without the class-teacher role for this arm may not take or correct
   * attendance for it. */
  async assertTeacherIsClassTeacherOfArm(classArmId: string): Promise<void> {
    if (this.requestContext.getRole() !== 'TEACHER') return;

    const userId = this.requestContext.getUserId();
    const staffProfile = await this.prisma.db.staffProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!staffProfile) {
      throw new ForbiddenException('No staff profile linked to this account');
    }

    const arm = await this.prisma.db.schoolClass.findFirstOrThrow({
      where: { arms: { some: { id: classArmId } } },
      select: { arms: { where: { id: classArmId }, select: { classTeacherId: true } } },
    });

    if (arm.arms[0]?.classTeacherId !== staffProfile.id) {
      throw new ForbiddenException('Only this class’s class teacher may take or correct its attendance');
    }
  }

  /** Every ClassArm id the current TEACHER may act on: as class teacher
   * (ClassArm.classTeacherId) or via any TeacherSubjectAssignment. Used to
   * scope list-style queries (StudentsService.list, teacher portal) the
   * same way assertTeacherCanActOnArm scopes single-arm writes. Returns
   * [] for a teacher with no staff profile or no assignments; callers for
   * other roles shouldn't call this. */
  async listArmIdsForCurrentTeacher(): Promise<string[]> {
    const userId = this.requestContext.getUserId();
    const staffProfile = await this.prisma.db.staffProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!staffProfile) return [];

    const [ledArms, assignments] = await Promise.all([
      this.prisma.db.classArm.findMany({
        where: { classTeacherId: staffProfile.id },
        select: { id: true },
      }),
      this.prisma.db.teacherSubjectAssignment.findMany({
        where: { staffProfileId: staffProfile.id },
        select: { schoolClassId: true },
      }),
    ]);

    const schoolClassIds = [...new Set(assignments.map((a) => a.schoolClassId))];
    const assignedArms = schoolClassIds.length
      ? await this.prisma.db.classArm.findMany({
          where: { schoolClassId: { in: schoolClassIds } },
          select: { id: true },
        })
      : [];

    return [...new Set([...ledArms.map((a) => a.id), ...assignedArms.map((a) => a.id)])];
  }

  /** Same set as listArmIdsForCurrentTeacher, with names attached: for
   * UI pickers (e.g. "which class am I posting this assignment to")
   * where a raw id isn't useful to show. */
  async listDetailedArmsForCurrentTeacher(): Promise<
    { id: string; schoolClassName: string; armName: string }[]
  > {
    const armIds = await this.listArmIdsForCurrentTeacher();
    if (!armIds.length) return [];

    const arms = await this.prisma.db.classArm.findMany({
      where: { id: { in: armIds } },
      select: { id: true, name: true, schoolClass: { select: { name: true } } },
    });
    return arms.map((a) => ({ id: a.id, schoolClassName: a.schoolClass.name, armName: a.name }));
  }

  /** Narrower than listDetailedArmsForCurrentTeacher: class-teacher arms
   * only, no subject-assignment arms. Backs the attendance-taking picker,
   * which mirrors assertTeacherIsClassTeacherOfArm's restriction. */
  async listClassTeacherArmsForCurrentTeacher(): Promise<
    { id: string; schoolClassName: string; armName: string }[]
  > {
    const userId = this.requestContext.getUserId();
    const staffProfile = await this.prisma.db.staffProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!staffProfile) return [];

    const arms = await this.prisma.db.classArm.findMany({
      where: { classTeacherId: staffProfile.id },
      select: { id: true, name: true, schoolClass: { select: { name: true } } },
    });
    return arms.map((a) => ({ id: a.id, schoolClassName: a.schoolClass.name, armName: a.name }));
  }
}
