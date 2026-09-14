import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceRecord, AttendanceStatus } from '@prisma/client';
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
    await this.classes.assertTeacherIsClassTeacherOfArm(dto.classArmId);
    await this.academicSessions.assertTermBelongsToTenant(dto.termId);
    await this.assertNotAlreadyTaken(dto.studentId, dto.date);

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
    await this.classes.assertTeacherIsClassTeacherOfArm(dto.classArmId);
    await this.academicSessions.assertTermBelongsToTenant(dto.termId);

    const students = await this.prisma.db.student.findMany({
      where: { id: { in: dto.entries.map((e) => e.studentId) } },
      select: { id: true, campusId: true },
    });
    const campusById = new Map(students.map((s) => [s.id, s.campusId]));
    if (campusById.size !== dto.entries.length) {
      throw new ForbiddenException('One or more studentIds are invalid for this tenant');
    }

    const existing = await this.prisma.db.attendanceRecord.findFirst({
      where: { classArmId: dto.classArmId, date: new Date(dto.date), correctionOf: null },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Attendance for this class has already been taken today — correct individual records instead of re-taking the register.',
      );
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

  /** TEACHER corrections land PENDING and have no effect until a
   * PROPRIETOR/PRINCIPAL reviews them (see approveCorrection/
   * rejectCorrection) — a PROPRIETOR/PRINCIPAL correcting is the review,
   * so theirs apply immediately. Either way this never overwrites the
   * original row; list() resolves which row is "current". */
  async correct(originalId: string, status: AttendanceStatus, correctionReason: string) {
    const original = await this.prisma.db.attendanceRecord.findUniqueOrThrow({
      where: { id: originalId },
    });
    await this.classes.assertTeacherIsClassTeacherOfArm(original.classArmId);

    const role = this.requestContext.getRole();
    const isAdmin = role === 'PROPRIETOR' || role === 'PRINCIPAL';

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
        correctionStatus: isAdmin ? 'APPROVED' : 'PENDING',
      }),
    });

    await this.audit.log({
      action: isAdmin ? 'ATTENDANCE_CORRECTED' : 'ATTENDANCE_CORRECTION_REQUESTED',
      entityType: 'AttendanceRecord',
      entityId: corrected.id,
      before: { status: original.status },
      after: { status: corrected.status, reason: correctionReason, correctionStatus: corrected.correctionStatus },
    });

    return corrected;
  }

  async approveCorrection(id: string) {
    const correction = await this.prisma.db.attendanceRecord.findUniqueOrThrow({ where: { id } });
    if (correction.correctionStatus !== 'PENDING') {
      throw new ConflictException(`This correction has already been ${(correction.correctionStatus || 'reviewed').toLowerCase()}`);
    }

    const updated = await this.prisma.db.attendanceRecord.update({
      where: { id },
      data: { correctionStatus: 'APPROVED' },
    });
    await this.audit.log({
      action: 'ATTENDANCE_CORRECTION_APPROVED',
      entityType: 'AttendanceRecord',
      entityId: id,
      before: { correctionStatus: 'PENDING' },
      after: { correctionStatus: 'APPROVED' },
    });
    return updated;
  }

  async rejectCorrection(id: string, reason: string) {
    const correction = await this.prisma.db.attendanceRecord.findUniqueOrThrow({ where: { id } });
    if (correction.correctionStatus !== 'PENDING') {
      throw new ConflictException(`This correction has already been ${(correction.correctionStatus || 'reviewed').toLowerCase()}`);
    }

    const updated = await this.prisma.db.attendanceRecord.update({
      where: { id },
      data: { correctionStatus: 'REJECTED', rejectionReason: reason },
    });
    await this.audit.log({
      action: 'ATTENDANCE_CORRECTION_REJECTED',
      entityType: 'AttendanceRecord',
      entityId: id,
      before: { correctionStatus: 'PENDING' },
      after: { correctionStatus: 'REJECTED', reason },
    });
    return updated;
  }

  /** The school-wide queue a PROPRIETOR/PRINCIPAL reviews — every
   * TEACHER-submitted correction still awaiting a decision. */
  async listPendingCorrections() {
    return this.prisma.db.attendanceRecord.findMany({
      where: { correctionStatus: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        student: { select: { firstName: true, lastName: true } },
        classArm: { select: { name: true, schoolClass: { select: { name: true } } } },
        recordedBy: { select: { firstName: true, lastName: true } },
      },
    });
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

    const records = await this.prisma.db.attendanceRecord.findMany({
      where: {
        classArmId: filter.classArmId,
        studentId: filter.studentId ?? (scopedStudentIds ? { in: scopedStudentIds } : undefined),
        termId: filter.termId,
        date: filter.date ? new Date(filter.date) : undefined,
      },
      orderBy: { date: 'desc' },
    });
    return this.resolveEffective(records);
  }

  /** Collapses a (studentId, date) group of rows — the original plus any
   * correction attempts — down to the single row that's actually "true"
   * right now: the most recently APPROVED correction if one exists,
   * otherwise the original. PENDING/REJECTED corrections never change
   * what's current; a PENDING one is only surfaced as a flag so viewers
   * know a review is outstanding. */
  private resolveEffective(records: AttendanceRecord[]): (AttendanceRecord & { hasPendingCorrection: boolean })[] {
    const groups = new Map<string, AttendanceRecord[]>();
    for (const r of records) {
      const key = `${r.studentId}|${r.date.toISOString()}`;
      const group = groups.get(key);
      if (group) group.push(r);
      else groups.set(key, [r]);
    }

    const effective: (AttendanceRecord & { hasPendingCorrection: boolean })[] = [];
    for (const group of groups.values()) {
      const root = group.find((r) => !r.correctionOf) ?? group[0];
      const approved = group
        .filter((r) => r.correctionStatus === 'APPROVED')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const winner = approved[0] ?? root;
      const hasPendingCorrection = group.some((r) => r.correctionStatus === 'PENDING');
      effective.push({ ...winner, hasPendingCorrection });
    }
    return effective.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  private async assertNotAlreadyTaken(studentId: string, isoDate: string): Promise<void> {
    const existing = await this.prisma.db.attendanceRecord.findFirst({
      where: { studentId, date: new Date(isoDate), correctionOf: null },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Attendance for this student has already been taken today — correct the existing record instead.',
      );
    }
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
