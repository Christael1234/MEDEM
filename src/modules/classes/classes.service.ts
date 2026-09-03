import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { RequestContextService } from '../../common/context/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
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
    // Campus is tenant-scoped — resolving it first confirms campusId
    // belongs to the caller's own tenant before SchoolClass references it.
    await this.prisma.db.campus.findUniqueOrThrow({ where: { id: dto.campusId } });

    return this.prisma.db.schoolClass.create({
      data: tenantScopedCreate({ campusId: dto.campusId, name: dto.name, order: dto.order ?? 0 }),
    });
  }

  listClasses(campusId?: string) {
    return this.prisma.db.schoolClass.findMany({
      where: campusId ? { campusId } : undefined,
      orderBy: { order: 'asc' },
      include: { arms: true },
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
    const updated = await this.prisma.db.schoolClass.update({
      where: { id },
      data: { name: dto.name ?? undefined },
    });

    await this.audit.log({
      action: 'CLASS_UPDATED',
      entityType: 'SchoolClass',
      entityId: id,
      before: { name: before.name },
      after: { name: updated.name },
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
   * itself which IS scoped) before the write — same pattern as
   * createArm/assertTeacherCanActOnArm. */
  async updateArm(id: string, dto: UpdateClassArmDto) {
    await this.assertArmBelongsToTenant(id);
    if (dto.classTeacherId) {
      await this.prisma.db.staffProfile.findUniqueOrThrow({ where: { id: dto.classTeacherId } });
    }

    const before = await this.prisma.db.classArm.findUniqueOrThrow({ where: { id } });
    const updated = await this.prisma.db.classArm.update({
      where: { id },
      data: { name: dto.name ?? undefined, classTeacherId: dto.classTeacherId ?? undefined },
    });

    await this.audit.log({
      action: 'CLASS_ARM_UPDATED',
      entityType: 'ClassArm',
      entityId: id,
      before: { name: before.name, classTeacherId: before.classTeacherId },
      after: { name: updated.name, classTeacherId: updated.classTeacherId },
    });

    return updated;
  }

  /** ClassArm has no tenantId column of its own. Querying its parent
   * SchoolClass — which IS tenant-scoped — with a relation filter on
   * `arms` confirms the arm belongs to the caller's tenant without ever
   * trusting a client-supplied tenantId. */
  async assertArmBelongsToTenant(classArmId: string): Promise<void> {
    await this.prisma.db.schoolClass.findFirstOrThrow({
      where: { arms: { some: { id: classArmId } } },
    });
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

  /** Every ClassArm id the current TEACHER may act on — as class teacher
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

  /** Same set as listArmIdsForCurrentTeacher, with names attached — for
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
}
