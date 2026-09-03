import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AnnouncementAudience } from '@prisma/client';
import { ClassesService } from '../classes/classes.service';
import { NotificationService } from '../notifications/notification.service';
import { RequestContextService } from '../../common/context/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

/**
 * Recipients are always resolved from the tenant-scoped roster at send
 * time (Phase 4 rule #2) — a client can target an audience *type* and a
 * reference id, never a literal list of user ids.
 */
@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
    private readonly notifications: NotificationService,
    private readonly requestContext: RequestContextService,
  ) {}

  async create(dto: CreateAnnouncementDto) {
    this.assertCanTargetAudience(dto.audience);
    const recipientUserIds = await this.resolveRecipients(dto);

    const senderUserId = this.requestContext.getUserId();
    if (!senderUserId) throw new ForbiddenException();

    const announcement = await this.prisma.db.announcement.create({
      data: tenantScopedCreate({
        campusId: dto.campusId,
        audience: dto.audience,
        audienceRefId: dto.audienceRefId,
        title: dto.title,
        body: dto.body,
        createdByUserId: senderUserId,
        publishedAt: new Date(),
      }),
    });

    for (const recipientUserId of recipientUserIds) {
      await this.notifications.notify({
        recipientUserId,
        eventType: 'ANNOUNCEMENT',
        title: dto.title,
        body: dto.body,
        entityType: 'Announcement',
        entityId: announcement.id,
        channels: ['IN_APP'],
        senderUserId,
        targetDescription: this.describeAudience(dto),
      });
    }

    return { ...announcement, recipientCount: recipientUserIds.length };
  }

  list() {
    return this.prisma.db.announcement.findMany({ orderBy: { createdAt: 'desc' } });
  }

  private assertCanTargetAudience(audience: AnnouncementAudience): void {
    const role = this.requestContext.getRole();
    if (role === 'PROPRIETOR' || role === 'PRINCIPAL') return;
    if (role === 'TEACHER' && (audience === 'CLASS' || audience === 'ARM')) return;
    throw new ForbiddenException(`Role ${role} cannot target audience ${audience}`);
  }

  private describeAudience(dto: CreateAnnouncementDto): string {
    return `${dto.audience}${dto.audienceRefId ? `:${dto.audienceRefId}` : ''}`;
  }

  private async resolveRecipients(dto: CreateAnnouncementDto): Promise<string[]> {
    switch (dto.audience) {
      case 'INDIVIDUAL': {
        if (!dto.audienceRefId) throw new BadRequestException('audienceRefId (User id) required for INDIVIDUAL');
        const user = await this.prisma.db.user.findUniqueOrThrow({ where: { id: dto.audienceRefId } });
        return [user.id];
      }
      case 'CLASS':
      case 'ARM': {
        if (!dto.audienceRefId) throw new BadRequestException('audienceRefId (ClassArm id) required');
        await this.classes.assertArmBelongsToTenant(dto.audienceRefId);
        if (this.requestContext.getRole() === 'TEACHER') {
          await this.classes.assertTeacherCanActOnArm(dto.audienceRefId);
        }
        return this.recipientsForArm(dto.audienceRefId, {
          includeStudents: true,
          includeGuardians: true,
          includeTeacher: true,
        });
      }
      case 'PARENT_GROUP': {
        if (!dto.audienceRefId) throw new BadRequestException('audienceRefId (ClassArm id) required');
        await this.classes.assertArmBelongsToTenant(dto.audienceRefId);
        return this.recipientsForArm(dto.audienceRefId, {
          includeStudents: false,
          includeGuardians: true,
          includeTeacher: false,
        });
      }
      case 'CAMPUS': {
        if (!dto.audienceRefId) throw new BadRequestException('audienceRefId (Campus id) required');
        await this.prisma.db.campus.findUniqueOrThrow({ where: { id: dto.audienceRefId } });
        return this.recipientsForCampus(dto.audienceRefId);
      }
      case 'SCHOOL': {
        const tenantId = this.requestContext.getTenantId();
        if (!tenantId) throw new ForbiddenException();
        const users = await this.prisma.db.user.findMany({ where: { tenantId }, select: { id: true } });
        return users.map((u) => u.id);
      }
    }
  }

  private async recipientsForArm(
    classArmId: string,
    opts: { includeStudents: boolean; includeGuardians: boolean; includeTeacher: boolean },
  ): Promise<string[]> {
    const students = await this.prisma.db.student.findMany({
      where: { currentClassArmId: classArmId },
      select: { id: true, userId: true },
    });
    const ids = new Set<string>();

    if (opts.includeStudents) {
      students.forEach((s) => {
        if (s.userId) ids.add(s.userId);
      });
    }

    if (opts.includeGuardians) {
      const studentIds = students.map((s) => s.id);
      if (studentIds.length) {
        const links = await this.prisma.db.studentGuardian.findMany({
          where: { studentId: { in: studentIds } },
          select: { guardian: { select: { userId: true } } },
        });
        links.forEach((l) => {
          if (l.guardian.userId) ids.add(l.guardian.userId);
        });
      }
    }

    if (opts.includeTeacher) {
      const arm = await this.prisma.db.classArm.findUnique({
        where: { id: classArmId },
        select: { classTeacher: { select: { userId: true } } },
      });
      if (arm?.classTeacher?.userId) ids.add(arm.classTeacher.userId);
    }

    return [...ids];
  }

  private async recipientsForCampus(campusId: string): Promise<string[]> {
    const ids = new Set<string>();
    const [scopedUsers, staff, students] = await Promise.all([
      this.prisma.db.userCampusScope.findMany({ where: { campusId }, select: { userId: true } }),
      this.prisma.db.staffProfile.findMany({ where: { campusId }, select: { userId: true } }),
      this.prisma.db.student.findMany({ where: { campusId }, select: { id: true, userId: true } }),
    ]);

    scopedUsers.forEach((u) => ids.add(u.userId));
    staff.forEach((s) => ids.add(s.userId));
    students.forEach((s) => {
      if (s.userId) ids.add(s.userId);
    });

    const studentIds = students.map((s) => s.id);
    if (studentIds.length) {
      const links = await this.prisma.db.studentGuardian.findMany({
        where: { studentId: { in: studentIds } },
        select: { guardian: { select: { userId: true } } },
      });
      links.forEach((l) => {
        if (l.guardian.userId) ids.add(l.guardian.userId);
      });
    }

    return [...ids];
  }
}
