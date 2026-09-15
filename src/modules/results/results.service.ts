import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AcademicSessionsService } from '../academic-sessions/academic-sessions.service';
import { AuditService } from '../audit/audit.service';
import { ClassesService } from '../classes/classes.service';
import { GradingScaleService } from '../grading-scale/grading-scale.service';
import { NotificationService } from '../notifications/notification.service';
import { StudentsService } from '../students/students.service';
import { RequestContextService } from '../../common/context/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { CreateResultDto } from './dto/create-result.dto';

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly academicSessions: AcademicSessionsService,
    private readonly students: StudentsService,
    private readonly classes: ClassesService,
    private readonly gradingScale: GradingScaleService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly requestContext: RequestContextService,
  ) {}

  async create(dto: CreateResultDto) {
    await this.assertTeacherCanEnterResult(dto.studentId, dto.subjectId);
    await this.prisma.db.academicSession.findUniqueOrThrow({ where: { id: dto.academicSessionId } });
    await this.academicSessions.assertTermBelongsToTenant(dto.termId);
    await this.prisma.db.subject.findUniqueOrThrow({ where: { id: dto.subjectId } });

    const totalScore = this.computeTotal(dto.continuousAssessmentScore, dto.examScore);
    // Computed once, against whatever grade bands exist right now, and
    // stored, see GradingScaleService.computeGrade's doc comment for why
    // this is never recalculated later. null (no band configured, or none
    // covers this score) is an honest "ungraded", not an error.
    const grade = totalScore === undefined ? null : await this.gradingScale.computeGrade(totalScore);

    return this.prisma.db.result.create({
      data: tenantScopedCreate({
        studentId: dto.studentId,
        subjectId: dto.subjectId,
        academicSessionId: dto.academicSessionId,
        termId: dto.termId,
        continuousAssessmentScore: dto.continuousAssessmentScore,
        examScore: dto.examScore,
        totalScore,
        grade,
        teacherComment: dto.teacherComment,
        status: 'DRAFT' as const,
        enteredById: this.requireUserId(),
      }),
    });
  }

  async submit(id: string) {
    const result = await this.prisma.db.result.findUniqueOrThrow({ where: { id } });
    this.assertTransition(result.status, 'DRAFT', 'submit');
    await this.assertTeacherCanEnterResult(result.studentId, result.subjectId);

    const updated = await this.prisma.db.result.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });
    await this.auditTransition('RESULT_SUBMITTED', id, result.status, updated.status);
    return updated;
  }

  async approve(id: string) {
    const result = await this.prisma.db.result.findUniqueOrThrow({ where: { id } });
    this.assertTransition(result.status, 'SUBMITTED', 'approve');

    const updated = await this.prisma.db.result.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date() },
    });
    await this.auditTransition('RESULT_APPROVED', id, result.status, updated.status);
    return updated;
  }

  async publish(id: string) {
    const result = await this.prisma.db.result.findUniqueOrThrow({ where: { id } });
    this.assertTransition(result.status, 'APPROVED', 'publish');

    const updated = await this.prisma.db.result.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    await this.auditTransition('RESULT_PUBLISHED', id, result.status, updated.status);
    await this.notifyResultPublished(updated.id, updated.studentId);
    return updated;
  }

  private async notifyResultPublished(resultId: string, studentId: string): Promise<void> {
    const student = await this.prisma.db.student.findUnique({
      where: { id: studentId },
      select: {
        userId: true,
        firstName: true,
        lastName: true,
        guardianLinks: { select: { guardian: { select: { userId: true } } } },
      },
    });
    if (!student) return;

    const recipientUserIds = new Set<string>();
    if (student.userId) recipientUserIds.add(student.userId);
    student.guardianLinks.forEach((link) => {
      if (link.guardian.userId) recipientUserIds.add(link.guardian.userId);
    });

    const title = 'A result was published';
    const body = `${student.firstName} ${student.lastName}'s result is now available.`;
    for (const recipientUserId of recipientUserIds) {
      await this.notifications.notify({
        recipientUserId,
        eventType: 'RESULT_PUBLISHED',
        title,
        body,
        entityType: 'Result',
        entityId: resultId,
        channels: ['IN_APP'],
        targetDescription: `student ${studentId}`,
      });
    }
  }

  /** PARENT/STUDENT only ever see PUBLISHED results for their own
   * children/self: draft, submitted and approved-but-unpublished results
   * are staff-internal by design. TEACHER is scoped to their own
   * assigned subject/class combinations ("strictly scoped to assigned
   * classes/subjects" per the access-control spec); without this, any
   * teacher could list every other teacher's marks for every subject. */
  async list(filter: { studentId?: string; subjectId?: string; termId?: string }) {
    const role = this.requestContext.getRole();
    const isFamily = role === 'STUDENT' || role === 'PARENT';
    const scopedStudentIds = isFamily ? await this.students.assignmentScopedStudentIds() : null;

    if (scopedStudentIds && filter.studentId && !scopedStudentIds.includes(filter.studentId)) {
      throw new ForbiddenException('No access to this student’s results');
    }

    let teacherScope: { studentIds: string[]; subjectIds: string[] } | null = null;
    if (role === 'TEACHER') {
      teacherScope = await this.teacherResultScope();
      if (filter.subjectId && !teacherScope.subjectIds.includes(filter.subjectId)) {
        throw new ForbiddenException('Not assigned to this subject');
      }
      if (filter.studentId && !teacherScope.studentIds.includes(filter.studentId)) {
        throw new ForbiddenException('No access to this student’s results');
      }
    }

    return this.prisma.db.result.findMany({
      where: {
        studentId:
          filter.studentId ??
          (scopedStudentIds
            ? { in: scopedStudentIds }
            : teacherScope
              ? { in: teacherScope.studentIds }
              : undefined),
        subjectId: filter.subjectId ?? (teacherScope ? { in: teacherScope.subjectIds } : undefined),
        termId: filter.termId,
        status: isFamily ? 'PUBLISHED' : undefined,
      },
      orderBy: { createdAt: 'desc' },
      // Names, not just FK ids: this is what the portal UIs display.
      include: {
        student: { select: { firstName: true, lastName: true } },
        subject: { select: { name: true } },
        term: { select: { name: true } },
      },
    });
  }

  /** The Reports page's academic performance report: average/highest/
   * lowest score, grade distribution and a per-subject breakdown, over
   * PUBLISHED results only (drafts/unapproved marks aren't a school's
   * "official" record yet). Real aggregation off real Result rows. */
  async report(filter: { termId?: string; subjectId?: string; classArmId?: string }) {
    const results = await this.prisma.db.result.findMany({
      where: {
        termId: filter.termId,
        subjectId: filter.subjectId,
        status: 'PUBLISHED',
        student: filter.classArmId ? { currentClassArmId: filter.classArmId } : undefined,
      },
      include: { subject: { select: { name: true } } },
    });

    const scores = results.map((r) => Number(r.totalScore ?? 0));
    const count = results.length;
    const average = count ? Math.round((scores.reduce((a, b) => a + b, 0) / count) * 10) / 10 : 0;
    const highest = count ? Math.max(...scores) : 0;
    const lowest = count ? Math.min(...scores) : 0;

    const gradeDistribution: Record<string, number> = {};
    for (const r of results) {
      const grade = r.grade ?? 'Ungraded';
      gradeDistribution[grade] = (gradeDistribution[grade] ?? 0) + 1;
    }

    const bySubjectMap = new Map<string, { name: string; count: number; totalScore: number }>();
    for (const r of results) {
      const bucket = bySubjectMap.get(r.subjectId) ?? { name: r.subject.name, count: 0, totalScore: 0 };
      bucket.count += 1;
      bucket.totalScore += Number(r.totalScore ?? 0);
      bySubjectMap.set(r.subjectId, bucket);
    }

    return {
      count,
      average,
      highest,
      lowest,
      gradeDistribution,
      bySubject: [...bySubjectMap.values()]
        .map((b) => ({ name: b.name, count: b.count, average: Math.round((b.totalScore / b.count) * 10) / 10 }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  /** The (students, subjects) a TEACHER may see results for: students in
   * any class arm they're assigned to, intersected with subjects they
   * hold a TeacherSubjectAssignment for. Mirrors
   * assertTeacherCanEnterResult's per-write check, but as a set for
   * listing rather than a single (studentId, subjectId) pair. */
  private async teacherResultScope(): Promise<{ studentIds: string[]; subjectIds: string[] }> {
    const userId = this.requestContext.getUserId();
    const staffProfile = await this.prisma.db.staffProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!staffProfile) return { studentIds: [], subjectIds: [] };

    const [armIds, assignments] = await Promise.all([
      this.classes.listArmIdsForCurrentTeacher(),
      this.prisma.db.teacherSubjectAssignment.findMany({
        where: { staffProfileId: staffProfile.id },
        select: { subjectId: true },
      }),
    ]);

    const students = armIds.length
      ? await this.prisma.db.student.findMany({
          where: { currentClassArmId: { in: armIds } },
          select: { id: true },
        })
      : [];

    return {
      studentIds: students.map((s) => s.id),
      subjectIds: [...new Set(assignments.map((a) => a.subjectId))],
    };
  }

  private computeTotal(ca?: number, exam?: number): number | undefined {
    if (ca === undefined && exam === undefined) return undefined;
    return (ca ?? 0) + (exam ?? 0);
  }

  private assertTransition(current: string, expected: string, action: string): void {
    if (current !== expected) {
      throw new ConflictException(`Cannot ${action} a result in status ${current}`);
    }
  }

  private async auditTransition(action: string, id: string, before: string, after: string) {
    await this.audit.log({
      action,
      entityType: 'Result',
      entityId: id,
      before: { status: before },
      after: { status: after },
    });
  }

  /** Mirrors ClassesService.assertTeacherCanActOnArm but keyed on
   * (student's current class, subject) since Result has no classArmId of
   * its own: a TEACHER may enter/submit only for a
   * TeacherSubjectAssignment they actually hold. */
  private async assertTeacherCanEnterResult(studentId: string, subjectId: string): Promise<void> {
    if (this.requestContext.getRole() !== 'TEACHER') return;

    const student = await this.prisma.db.student.findUniqueOrThrow({
      where: { id: studentId },
      select: { currentClassArmId: true },
    });
    if (!student.currentClassArmId) {
      throw new ForbiddenException('Student has no current class assigned');
    }

    const schoolClass = await this.prisma.db.schoolClass.findFirstOrThrow({
      where: { arms: { some: { id: student.currentClassArmId } } },
      select: { id: true },
    });

    const userId = this.requestContext.getUserId();
    const staffProfile = await this.prisma.db.staffProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!staffProfile) {
      throw new ForbiddenException('No staff profile linked to this account');
    }

    const assignment = await this.prisma.db.teacherSubjectAssignment.findFirst({
      where: { staffProfileId: staffProfile.id, schoolClassId: schoolClass.id, subjectId },
    });
    if (!assignment) {
      throw new ForbiddenException('Teacher is not assigned to this class/subject');
    }
  }

  private requireUserId(): string {
    const userId = this.requestContext.getUserId();
    if (!userId) throw new NotFoundException();
    return userId;
  }
}
