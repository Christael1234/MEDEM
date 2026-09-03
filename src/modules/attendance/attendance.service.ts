import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { AcademicSessionsService } from '../academic-sessions/academic-sessions.service';
import { AuditService } from '../audit/audit.service';
import { ClassesService } from '../classes/classes.service';
import { NotificationService } from '../notifications/notification.service';
import { StudentsService } from '../students/students.service';
import { RequestContextService } from '../../common/context/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';
import { CreateAttendanceDto } from './dto/create-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
    private readonly academicSessions: AcademicSessionsService,
    private readonly students: StudentsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly requestContext: RequestContextService,
  ) {}

  async record(dto: CreateAttendanceDto) {
    await this.classes.assertArmBelongsToTenant(dto.classArmId);
    await this.classes.assertTeacherCanActOnArm(dto.classArmId);
    await this.academicSessions.assertTermBelongsToTenant(dto.termId);

    const student = await this.prisma.db.student.findUniqueOrThrow({
      where: { id: dto.studentId },
    });

    const recordedById = this.requireUserId();

    const record = await this.prisma.db.attendanceRecord.create({
      data: tenantScopedCreate({
        campusId: student.campusId,
        studentId: dto.studentId,
        classArmId: dto.classArmId,
        termId: dto.termId,
        date: new Date(dto.date),
        status: dto.status,
        recordedById,
      }),
    });
    await this.notifyIfAbsent(record.id, dto.studentId, dto.status);
    return record;
  }

  /** Take attendance for a whole class arm in one call — the realistic
   * teacher workflow rather than one record at a time. */
  async recordBulk(dto: BulkAttendanceDto) {
    await this.classes.assertArmBelongsToTenant(dto.classArmId);
    await this.classes.assertTeacherCanActOnArm(dto.classArmId);
    await this.academicSessions.assertTermBelongsToTenant(dto.termId);

    const students = await this.prisma.db.student.findMany({
      where: { id: { in: dto.entries.map((e) => e.studentId) } },
      select: { id: true, campusId: true },
    });
    const campusById = new Map(students.map((s) => [s.id, s.campusId]));
    if (campusById.size !== dto.entries.length) {
      throw new ForbiddenException('One or more studentIds are invalid for this tenant');
    }

    const recordedById = this.requireUserId();
    const date = new Date(dto.date);

    const records = await this.prisma.db.$transaction(
      dto.entries.map((entry) =>
        this.prisma.db.attendanceRecord.create({
          data: tenantScopedCreate({
            campusId: campusById.get(entry.studentId)!,
            studentId: entry.studentId,
            classArmId: dto.classArmId,
            termId: dto.termId,
            date,
            status: entry.status,
            recordedById,
          }),
        }),
      ),
    );

    for (const record of records) {
      await this.notifyIfAbsent(record.id, record.studentId, record.status);
    }
    return records;
  }

  async correct(originalId: string, status: AttendanceStatus, correctionReason: string) {
    const original = await this.prisma.db.attendanceRecord.findUniqueOrThrow({
      where: { id: originalId },
    });
    await this.classes.assertTeacherCanActOnArm(original.classArmId);

    const corrected = await this.prisma.db.attendanceRecord.create({
      data: tenantScopedCreate({
        campusId: original.campusId,
        studentId: original.studentId,
        classArmId: original.classArmId,
        termId: original.termId,
        date: original.date,
        status,
        recordedById: this.requireUserId(),
        correctionOf: original.id,
        correctionReason,
      }),
    });

    await this.audit.log({
      action: 'ATTENDANCE_CORRECTED',
      entityType: 'AttendanceRecord',
      entityId: corrected.id,
      before: { status: original.status },
      after: { status: corrected.status, reason: correctionReason },
    });

    return corrected;
  }

  async list(filter: { classArmId?: string; studentId?: string; termId?: string; date?: string }) {
    const role = this.requestContext.getRole();
    const scopedStudentIds =
      role === 'STUDENT' || role === 'PARENT' ? await this.students.assignmentScopedStudentIds() : null;

    if (scopedStudentIds) {
      if (filter.studentId && !scopedStudentIds.includes(filter.studentId)) {
        throw new ForbiddenException('No access to this student’s attendance');
      }
    }

    return this.prisma.db.attendanceRecord.findMany({
      where: {
        classArmId: filter.classArmId,
        studentId: filter.studentId ?? (scopedStudentIds ? { in: scopedStudentIds } : undefined),
        termId: filter.termId,
        date: filter.date ? new Date(filter.date) : undefined,
      },
      orderBy: { date: 'desc' },
    });
  }

  private requireUserId(): string {
    const userId = this.requestContext.getUserId();
    if (!userId) throw new NotFoundException();
    return userId;
  }

  private async notifyIfAbsent(
    attendanceRecordId: string,
    studentId: string,
    status: AttendanceStatus,
  ): Promise<void> {
    if (status !== 'ABSENT') return;

    const student = await this.prisma.db.student.findUnique({
      where: { id: studentId },
      select: {
        firstName: true,
        lastName: true,
        guardianLinks: { select: { guardian: { select: { userId: true } } } },
      },
    });
    if (!student) return;

    const title = 'Absence recorded';
    const body = `${student.firstName} ${student.lastName} was marked absent today.`;
    for (const link of student.guardianLinks) {
      if (!link.guardian.userId) continue;
      await this.notifications.notify({
        recipientUserId: link.guardian.userId,
        eventType: 'ATTENDANCE_ALERT',
        title,
        body,
        entityType: 'AttendanceRecord',
        entityId: attendanceRecordId,
        channels: ['IN_APP'],
        targetDescription: `guardian of student ${studentId}`,
      });
    }
  }
}
