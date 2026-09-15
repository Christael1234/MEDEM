import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ClassesService } from '../classes/classes.service';
import { NotificationService } from '../notifications/notification.service';
import { RequestContextService } from '../../common/context/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { CreateCbtExamDto } from './dto/create-cbt-exam.dto';
import { RejectCbtExamDto } from './dto/reject-cbt-exam.dto';
import { SubmitCbtAttemptDto } from './dto/submit-cbt-attempt.dto';

@Injectable()
export class CbtExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
    private readonly requestContext: RequestContextService,
  ) {}

  /** Teacher-authored only, mirrors LessonsService.create. Unlike
   * Lesson/Assignment, an exam starts life invisible to everyone but its
   * author and goes through submit/approve before students can see it
   * (see the status filtering in listForClassArm/assertReadAccess). */
  async create(dto: CreateCbtExamDto) {
    await this.classes.assertTeacherCanActOnArm(dto.classArmId);
    await this.prisma.db.subject.findUniqueOrThrow({ where: { id: dto.subjectId } });

    for (const q of dto.questions) {
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        throw new BadRequestException(`Question "${q.text}" must have exactly one correct option`);
      }
    }

    const userId = this.requestContext.getUserId();
    const staffProfile = await this.prisma.db.staffProfile.findUnique({ where: { userId } });
    if (!staffProfile) {
      throw new ForbiddenException('No staff profile linked to this account');
    }

    return this.prisma.db.cbtExam.create({
      data: tenantScopedCreate({
        classArmId: dto.classArmId,
        subjectId: dto.subjectId,
        createdByStaffProfileId: staffProfile.id,
        title: dto.title,
        durationMinutes: dto.durationMinutes,
        status: 'DRAFT' as const,
        questions: {
          create: dto.questions.map((q, qi) => ({
            text: q.text,
            order: qi,
            options: {
              create: q.options.map((o, oi) => ({ text: o.text, isCorrect: o.isCorrect, order: oi })),
            },
          })),
        },
      }),
      include: { questions: { include: { options: true } } },
    });
  }

  /** STUDENT/PARENT only ever see PUBLISHED exams (draft/submitted exams
   * are staff-internal, same discipline as Result). TEACHER sees every
   * PUBLISHED exam for the arm plus their own drafts/submitted ones, not
   * a co-teacher's unpublished question bank. PRINCIPAL/PROPRIETOR/other
   * staff see everything, since they're the approvers. */
  async listForClassArm(classArmId: string) {
    await this.assertReadAccess(classArmId);
    const role = this.requestContext.getRole();
    const userId = this.requestContext.getUserId();

    let studentId: string | undefined;
    if (role === 'STUDENT') {
      const student = await this.prisma.db.student.findFirst({ where: { userId }, select: { id: true } });
      studentId = student?.id;
    }

    let teacherStaffProfileId: string | undefined;
    if (role === 'TEACHER') {
      const staffProfile = await this.prisma.db.staffProfile.findUnique({ where: { userId }, select: { id: true } });
      teacherStaffProfileId = staffProfile?.id;
    }

    const exams = await this.prisma.db.cbtExam.findMany({
      where: {
        classArmId,
        ...(role === 'STUDENT' || role === 'PARENT' ? { status: 'PUBLISHED' as const } : {}),
        ...(role === 'TEACHER'
          ? { OR: [{ status: 'PUBLISHED' as const }, { createdByStaffProfileId: teacherStaffProfileId ?? '__none__' }] }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        subject: { select: { name: true } },
        createdByStaffProfile: { select: { user: { select: { firstName: true, lastName: true } } } },
        _count: { select: { questions: true } },
        attempts: {
          where: { studentId: studentId ?? '__none__' },
          select: { status: true, score: true, totalMarks: true },
        },
      },
    });

    return exams.map(({ attempts, ...rest }) => ({ ...rest, myAttempt: attempts[0] ?? null }));
  }

  /** Every exam status/statutory review that isn't a TEACHER/PRINCIPAL/
   * PROPRIETOR/eligible-STUDENT is denied outright (deny by default),
   * BURSAR/HR/other staff have no reason to read exam question banks.
   * Options carry isCorrect only for the author teacher and
   * principal/proprietor; a STUDENT taking the exam never receives it. */
  async getOne(id: string) {
    const exam = await this.prisma.db.cbtExam.findUniqueOrThrow({
      where: { id },
      include: {
        subject: { select: { name: true } },
        classArm: { select: { name: true, schoolClass: { select: { name: true } } } },
        createdByStaffProfile: { select: { user: { select: { firstName: true, lastName: true } } } },
        questions: { orderBy: { order: 'asc' }, include: { options: { orderBy: { order: 'asc' } } } },
      },
    });

    const role = this.requestContext.getRole();

    if (role === 'TEACHER') {
      await this.assertOwnerTeacher(exam);
      return exam;
    }

    if (role === 'PRINCIPAL' || role === 'PROPRIETOR') {
      return exam;
    }

    if (role === 'STUDENT') {
      if (exam.status !== 'PUBLISHED') {
        throw new ForbiddenException('This exam is not available yet');
      }
      const userId = this.requestContext.getUserId();
      const student = await this.prisma.db.student.findFirst({
        where: { userId },
        select: { currentClassArmId: true },
      });
      if (!student || student.currentClassArmId !== exam.classArmId) {
        throw new ForbiddenException('No access to this exam');
      }
      return {
        ...exam,
        questions: exam.questions.map((q) => ({
          ...q,
          options: q.options.map((o) => ({ id: o.id, text: o.text, order: o.order })),
        })),
      };
    }

    throw new ForbiddenException('No access to this exam');
  }

  async submitForApproval(id: string) {
    const exam = await this.prisma.db.cbtExam.findUniqueOrThrow({ where: { id } });
    this.assertTransition(exam.status, 'DRAFT', 'submit');
    await this.assertOwnerTeacher(exam);

    return this.prisma.db.cbtExam.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), rejectionReason: null },
    });
  }

  async approve(id: string) {
    const exam = await this.prisma.db.cbtExam.findUniqueOrThrow({ where: { id } });
    this.assertTransition(exam.status, 'SUBMITTED', 'approve');

    const updated = await this.prisma.db.cbtExam.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date(), rejectionReason: null },
    });
    await this.audit.log({
      action: 'CBT_EXAM_PUBLISHED',
      entityType: 'CbtExam',
      entityId: id,
      before: { status: exam.status },
      after: { status: updated.status },
    });
    await this.notifyExamPublished(updated.id, updated.classArmId, updated.title);
    return updated;
  }

  async reject(id: string, dto: RejectCbtExamDto) {
    const exam = await this.prisma.db.cbtExam.findUniqueOrThrow({ where: { id } });
    this.assertTransition(exam.status, 'SUBMITTED', 'reject');

    const updated = await this.prisma.db.cbtExam.update({
      where: { id },
      data: { status: 'DRAFT', rejectionReason: dto.reason },
    });
    await this.audit.log({
      action: 'CBT_EXAM_REJECTED',
      entityType: 'CbtExam',
      entityId: id,
      before: { status: exam.status },
      after: { status: updated.status, rejectionReason: dto.reason },
    });
    return updated;
  }

  /** Tenant-wide (CbtExam carries its own tenantId, so this is a single
   * auto-scoped query, unlike Lesson's oversight view, which has to loop
   * every class arm since Lesson has no equivalent "list all" route). */
  async listPendingReview() {
    return this.prisma.db.cbtExam.findMany({
      where: { status: 'SUBMITTED' },
      orderBy: { submittedAt: 'asc' },
      include: {
        subject: { select: { name: true } },
        classArm: { select: { name: true, schoolClass: { select: { name: true } } } },
        createdByStaffProfile: { select: { user: { select: { firstName: true, lastName: true } } } },
        _count: { select: { questions: true } },
      },
    });
  }

  /** Idempotent/resumable: a second call for an already-in-progress
   * attempt just returns it rather than erroring, so a page refresh
   * mid-exam doesn't lose the student's attempt. */
  async startAttempt(examId: string) {
    const exam = await this.prisma.db.cbtExam.findUniqueOrThrow({ where: { id: examId } });
    if (exam.status !== 'PUBLISHED') {
      throw new ForbiddenException('This exam is not open for attempts');
    }

    const userId = this.requestContext.getUserId();
    const student = await this.prisma.db.student.findFirst({
      where: { userId },
      select: { id: true, currentClassArmId: true },
    });
    if (!student || student.currentClassArmId !== exam.classArmId) {
      throw new ForbiddenException('No access to this exam');
    }

    const existing = await this.prisma.db.cbtAttempt.findUnique({
      where: { examId_studentId: { examId, studentId: student.id } },
    });
    if (existing) {
      if (existing.status === 'SUBMITTED') {
        throw new ConflictException('You have already submitted this exam');
      }
      return existing;
    }

    return this.prisma.db.cbtAttempt.create({ data: { examId, studentId: student.id } });
  }

  /** Auto-grades against CbtOption.isCorrect at submit time: grading is
   * never recomputed later, so a subsequent edit to the question bank
   * (there is none today, but if added) wouldn't silently reshuffle a
   * student's already-recorded score. */
  async submitAttempt(examId: string, attemptId: string, dto: SubmitCbtAttemptDto) {
    const attempt = await this.prisma.db.cbtAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    if (attempt.examId !== examId) {
      throw new ForbiddenException('Attempt does not belong to this exam');
    }
    if (attempt.status !== 'IN_PROGRESS') {
      throw new ConflictException('This attempt has already been submitted');
    }

    const userId = this.requestContext.getUserId();
    const student = await this.prisma.db.student.findFirst({ where: { userId }, select: { id: true } });
    if (!student || student.id !== attempt.studentId) {
      throw new ForbiddenException('Not your attempt');
    }

    const questions = await this.prisma.db.cbtQuestion.findMany({
      where: { examId },
      include: { options: true },
    });

    let score = 0;
    const answerRows = questions.map((q) => {
      const given = dto.answers.find((a) => a.questionId === q.id);
      const selectedOption = given?.selectedOptionId
        ? q.options.find((o) => o.id === given.selectedOptionId)
        : undefined;
      const isCorrect = !!selectedOption?.isCorrect;
      if (isCorrect) score++;
      return { attemptId, questionId: q.id, selectedOptionId: selectedOption?.id, isCorrect };
    });

    await this.prisma.db.cbtAnswer.createMany({ data: answerRows });

    return this.prisma.db.cbtAttempt.update({
      where: { id: attemptId },
      data: { status: 'SUBMITTED', score, totalMarks: questions.length, submittedAt: new Date() },
    });
  }

  /** Aggregate stats mirror what the mock exam-results modal always
   * promised (average/highest/lowest score, completion rate), now
   * computed from real CbtAttempt rows instead of hardcoded numbers.
   * completionRate is against ACTIVE students currently in the arm, not
   * just students who started an attempt. */
  async listAttempts(examId: string) {
    const exam = await this.prisma.db.cbtExam.findUniqueOrThrow({ where: { id: examId } });
    if (this.requestContext.getRole() === 'TEACHER') {
      await this.assertOwnerTeacher(exam);
    }

    const attempts = await this.prisma.db.cbtAttempt.findMany({
      where: { examId },
      orderBy: { submittedAt: 'desc' },
      include: { student: { select: { firstName: true, lastName: true, admissionNo: true } } },
    });

    const submitted = attempts.filter(
      (a): a is typeof a & { score: number; totalMarks: number } =>
        a.status === 'SUBMITTED' && a.score !== null && !!a.totalMarks,
    );
    const percentages = submitted.map((a) => Math.round((a.score / a.totalMarks) * 100));

    const totalStudents = await this.prisma.db.student.count({
      where: { currentClassArmId: exam.classArmId, status: 'ACTIVE' },
    });

    return {
      attempts,
      stats: {
        averagePct: percentages.length
          ? Math.round(percentages.reduce((s, p) => s + p, 0) / percentages.length)
          : null,
        highestPct: percentages.length ? Math.max(...percentages) : null,
        lowestPct: percentages.length ? Math.min(...percentages) : null,
        completionRate: totalStudents ? Math.round((submitted.length / totalStudents) * 100) : null,
      },
    };
  }

  private async notifyExamPublished(examId: string, classArmId: string, title: string): Promise<void> {
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

    for (const recipientUserId of recipientUserIds) {
      await this.notifications.notify({
        recipientUserId,
        eventType: 'CBT_EXAM_PUBLISHED',
        title: 'A new CBT exam is available',
        body: `${title} is now open.`,
        entityType: 'CbtExam',
        entityId: examId,
        channels: ['IN_APP'],
        targetDescription: `class arm ${classArmId}`,
      });
    }
  }

  private assertTransition(current: string, expected: string, action: string): void {
    if (current !== expected) {
      throw new ConflictException(`Cannot ${action} an exam in status ${current}`);
    }
  }

  private async assertOwnerTeacher(exam: { createdByStaffProfileId: string }): Promise<void> {
    const userId = this.requestContext.getUserId();
    const staffProfile = await this.prisma.db.staffProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!staffProfile || staffProfile.id !== exam.createdByStaffProfileId) {
      throw new ForbiddenException('Only the teacher who created this exam may manage it');
    }
  }

  /** Mirrors LessonsService.assertReadAccess exactly. */
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
        throw new ForbiddenException('No access to this class’s exams');
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
        throw new ForbiddenException('No access to this class’s exams');
      }
      return;
    }

    await this.classes.assertArmBelongsToTenant(classArmId);
  }
}
