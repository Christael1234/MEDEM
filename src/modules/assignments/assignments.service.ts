import { ForbiddenException, Injectable } from '@nestjs/common';
import { ClassesService } from '../classes/classes.service';
import { NotificationService } from '../notifications/notification.service';
import { RequestContextService } from '../../common/context/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
    private readonly notifications: NotificationService,
    private readonly requestContext: RequestContextService,
  ) {}

  async create(dto: CreateAssignmentDto) {
    await this.classes.assertArmBelongsToTenant(dto.classArmId);
    await this.classes.assertTeacherCanActOnArm(dto.classArmId);

    // TEACHER always has a StaffProfile (assertTeacherCanActOnArm above
    // already required one to get this far). PROPRIETOR/PRINCIPAL posting
    // administratively usually don't have one, that's fine, the field is
    // optional for exactly this case.
    const userId = this.requestContext.getUserId();
    const staffProfile = await this.prisma.db.staffProfile.findUnique({ where: { userId } });

    if (dto.subjectId) {
      await this.prisma.db.subject.findUniqueOrThrow({ where: { id: dto.subjectId } });
    }

    const assignment = await this.prisma.db.assignment.create({
      data: tenantScopedCreate({
        classArmId: dto.classArmId,
        subjectId: dto.subjectId,
        createdByStaffProfileId: staffProfile?.id,
        title: dto.title,
        description: dto.description,
        resourceUrl: dto.resourceUrl,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      }),
    });

    await this.notifyAssignmentPosted(assignment.id, dto.classArmId, dto.title, dto.dueDate);
    return assignment;
  }

  private async notifyAssignmentPosted(
    assignmentId: string,
    classArmId: string,
    title: string,
    dueDate?: string,
  ): Promise<void> {
    const students = await this.prisma.db.student.findMany({
      where: { currentClassArmId: classArmId },
      select: { userId: true, guardianLinks: { select: { guardian: { select: { userId: true } } } } },
    });

    const recipientUserIds = new Set<string>();
    students.forEach((s) => {
      if (s.userId) recipientUserIds.add(s.userId);
      s.guardianLinks.forEach((link) => {
        if (link.guardian.userId) recipientUserIds.add(link.guardian.userId);
      });
    });

    const body = dueDate ? `${title}, due ${dueDate}.` : `${title} was posted for your class.`;
    for (const recipientUserId of recipientUserIds) {
      await this.notifications.notify({
        recipientUserId,
        eventType: 'ASSIGNMENT_POSTED',
        title: 'New assignment posted',
        body,
        entityType: 'Assignment',
        entityId: assignmentId,
        channels: ['IN_APP'],
        targetDescription: `class arm ${classArmId}`,
      });
    }
  }

  async listForClassArm(classArmId: string) {
    await this.assertReadAccess(classArmId);
    return this.prisma.db.assignment.findMany({
      where: { classArmId },
      orderBy: { createdAt: 'desc' },
      include: { subject: { select: { name: true } } },
    });
  }

  async update(id: string, dto: UpdateAssignmentDto) {
    const existing = await this.prisma.db.assignment.findUniqueOrThrow({ where: { id } });

    if (this.requestContext.getRole() === 'TEACHER') {
      const userId = this.requestContext.getUserId();
      const staffProfile = await this.prisma.db.staffProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!staffProfile || staffProfile.id !== existing.createdByStaffProfileId) {
        throw new ForbiddenException('Only the teacher who created this assignment may edit it');
      }
    }

    return this.prisma.db.assignment.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        resourceUrl: dto.resourceUrl,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

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
        throw new ForbiddenException('No access to this class’s assignments');
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
        throw new ForbiddenException('No access to this class’s assignments');
      }
      return;
    }

    // PROPRIETOR / PRINCIPAL / other staff: tenant ownership is the only check.
    await this.classes.assertArmBelongsToTenant(classArmId);
  }
}
