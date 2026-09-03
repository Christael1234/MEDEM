import { ForbiddenException, Injectable } from '@nestjs/common';
import { ClassesService } from '../classes/classes.service';
import { RequestContextService } from '../../common/context/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { CreateLessonResourceDto } from './dto/create-lesson-resource.dto';

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
    private readonly requestContext: RequestContextService,
  ) {}

  /** Teacher-authored only (@Roles('TEACHER') at the controller) —
   * unlike Assignment, PROPRIETOR/PRINCIPAL don't post lessons, so there's
   * no nullable-staffProfile case to handle here. */
  async create(dto: CreateLessonDto) {
    await this.classes.assertTeacherCanActOnArm(dto.classArmId);
    await this.prisma.db.subject.findUniqueOrThrow({ where: { id: dto.subjectId } });

    const userId = this.requestContext.getUserId();
    const staffProfile = await this.prisma.db.staffProfile.findUnique({ where: { userId } });
    if (!staffProfile) {
      throw new ForbiddenException('No staff profile linked to this account');
    }

    return this.prisma.db.lesson.create({
      data: tenantScopedCreate({
        classArmId: dto.classArmId,
        subjectId: dto.subjectId,
        createdByStaffProfileId: staffProfile.id,
        title: dto.title,
        notes: dto.notes,
      }),
      include: { subject: { select: { name: true } }, resources: true },
    });
  }

  async listForClassArm(classArmId: string) {
    await this.assertReadAccess(classArmId);
    return this.prisma.db.lesson.findMany({
      where: { classArmId },
      orderBy: { createdAt: 'desc' },
      include: {
        subject: { select: { name: true } },
        createdByStaffProfile: { select: { user: { select: { firstName: true, lastName: true } } } },
        resources: true,
      },
    });
  }

  /** Adding a resource is restricted to the lesson's own author — same
   * ownership check as AssignmentsService.update(), just without the
   * PROPRIETOR/PRINCIPAL administrative-post case (they never author
   * lessons, so there's no equivalent bypass to write here). */
  async addResource(lessonId: string, dto: CreateLessonResourceDto) {
    const lesson = await this.prisma.db.lesson.findUniqueOrThrow({ where: { id: lessonId } });

    const userId = this.requestContext.getUserId();
    const staffProfile = await this.prisma.db.staffProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!staffProfile || staffProfile.id !== lesson.createdByStaffProfileId) {
      throw new ForbiddenException('Only the teacher who created this lesson may add resources to it');
    }

    return this.prisma.db.lessonResource.create({
      data: { lessonId, name: dto.name, type: dto.type, url: dto.url },
    });
  }

  /** Mirrors AssignmentsService.assertReadAccess exactly — TEACHER
   * scoped to their own class arms, STUDENT/PARENT scoped to their own
   * (child's) current class, everyone else (PROPRIETOR/PRINCIPAL/other
   * staff) just needs the arm to belong to their own tenant. */
  private async assertReadAccess(classArmId: string): Promise<void> {
    const role = this.requestContext.getRole();

    if (role === 'TEACHER') {
      await this.classes.assertTeacherCanActOnArm(classArmId);
      return;
    }

    if (role === 'STUDENT') {
      const userId = this.requestContext.getUserId();
      const student = await this.prisma.db.student.findFirst({
        where: { userId },
        select: { currentClassArmId: true },
      });
      if (!student || student.currentClassArmId !== classArmId) {
        throw new ForbiddenException('No access to this class’s lessons');
      }
      return;
    }

    if (role === 'PARENT') {
      const userId = this.requestContext.getUserId();
      const guardian = await this.prisma.db.guardian.findFirst({
        where: { userId },
        select: { studentLinks: { select: { student: { select: { currentClassArmId: true } } } } },
      });
      const hasChildInClass = guardian?.studentLinks.some(
        (link) => link.student.currentClassArmId === classArmId,
      );
      if (!hasChildInClass) {
        throw new ForbiddenException('No access to this class’s lessons');
      }
      return;
    }

    await this.classes.assertArmBelongsToTenant(classArmId);
  }
}
