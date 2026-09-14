import { Body, Controller, ForbiddenException, Get, Post } from '@nestjs/common';
import { Roles } from '../../../common/rbac/decorators/roles.decorator';
import { RequestContextService } from '../../../common/context/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AssignmentsService } from '../../assignments/assignments.service';
import { AttendanceService } from '../../attendance/attendance.service';
import { ClassesService } from '../../classes/classes.service';
import { ResultsService } from '../../results/results.service';
import { RequestStreamChangeDto } from '../../students/dto/request-stream-change.dto';
import { StudentsService } from '../../students/students.service';
import { TimetableService } from '../../timetable/timetable.service';

/**
 * Read-side aggregation over the student's own records. Every underlying
 * service call already enforces STUDENT scoping (own-record only,
 * published-only results) — this controller just resolves "my student
 * id" once and reuses those services, per the doc's "don't duplicate
 * their queries" guidance.
 */
@Controller('portal/student')
export class StudentPortalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly results: ResultsService,
    private readonly attendance: AttendanceService,
    private readonly assignments: AssignmentsService,
    private readonly requestContext: RequestContextService,
    private readonly timetable: TimetableService,
    private readonly students: StudentsService,
    private readonly classes: ClassesService,
  ) {}

  @Roles('STUDENT')
  @Get('results')
  async myResults() {
    const studentId = await this.myStudentId();
    // ResultsService.list forces status=PUBLISHED for the STUDENT role —
    // draft/submitted/approved-but-unpublished results never surface here.
    return this.results.list({ studentId });
  }

  @Roles('STUDENT')
  @Get('attendance')
  async myAttendance() {
    const studentId = await this.myStudentId();
    return this.attendance.list({ studentId });
  }

  @Roles('STUDENT')
  @Get('assignments')
  async myAssignments() {
    const classArmId = await this.myClassArmId();
    if (!classArmId) return [];
    return this.assignments.listForClassArm(classArmId);
  }

  @Roles('STUDENT')
  @Get('timetable')
  myTimetable() {
    return this.timetable.getForCurrentStudent();
  }

  @Roles('STUDENT')
  @Get('me')
  async myProfile() {
    const userId = this.requestContext.getUserId();
    if (!userId) throw new ForbiddenException();
    const student = await this.prisma.db.student.findUniqueOrThrow({
      where: { userId },
      include: {
        currentClassArm: { include: { schoolClass: { select: { id: true, name: true, level: true } } } },
        guardianLinks: {
          include: { guardian: { select: { firstName: true, lastName: true, phone: true, email: true } } },
        },
      },
    });
    // Drives whether the portal offers "Request stream change" at all —
    // only a student's first Senior Secondary class (see
    // ClassesService.isEntrySeniorSecondaryClass) is eligible.
    const canRequestStreamChange = student.currentClassArm
      ? await this.classes.isEntrySeniorSecondaryClass(student.currentClassArm.schoolClass.id)
      : false;
    return { ...student, canRequestStreamChange };
  }

  // Self-service — but only a request, and only for SS1 (see
  // StudentsService.requestStreamChange for why): every other Senior
  // Secondary student's stream can only change via an admin using
  // PATCH /students/:id/stream directly.
  @Roles('STUDENT')
  @Post('stream-requests')
  async requestMyStreamChange(@Body() dto: RequestStreamChangeDto) {
    const studentId = await this.myStudentId();
    return this.students.requestStreamChange(studentId, dto.requestedStream, dto.reason);
  }

  @Roles('STUDENT')
  @Get('stream-requests')
  async myStreamChangeRequests() {
    const studentId = await this.myStudentId();
    return this.students.listStreamChangeRequests(undefined, studentId);
  }

  @Roles('STUDENT')
  @Get('subjects')
  async mySubjects() {
    const userId = this.requestContext.getUserId();
    if (!userId) throw new ForbiddenException();
    const me = await this.prisma.db.student.findUniqueOrThrow({
      where: { userId },
      select: { currentClassArmId: true, stream: true },
    });
    if (!me.currentClassArmId) return [];

    // TeacherSubjectAssignment is keyed by SchoolClass, not ClassArm —
    // resolve the parent class first (same pattern as
    // ClassesService.assertTeacherCanActOnArm).
    const schoolClass = await this.prisma.db.schoolClass.findFirstOrThrow({
      where: { arms: { some: { id: me.currentClassArmId } } },
      select: { id: true },
    });

    const assignments = await this.prisma.db.teacherSubjectAssignment.findMany({
      where: { schoolClassId: schoolClass.id },
      include: {
        subject: { select: { name: true, streams: true } },
        staffProfile: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    // A Senior Secondary student who's picked a stream only sees subjects
    // that apply to it — a subject with no streams tagged is "any stream"
    // (same convention as an empty `levels`), so it still shows either way.
    if (!me.stream) return assignments;
    return assignments.filter((a) => !a.subject.streams.length || a.subject.streams.includes(me.stream!));
  }

  private async myStudentId(): Promise<string> {
    const userId = this.requestContext.getUserId();
    if (!userId) throw new ForbiddenException();
    const student = await this.prisma.db.student.findUniqueOrThrow({ where: { userId } });
    return student.id;
  }

  private async myClassArmId(): Promise<string | null> {
    const userId = this.requestContext.getUserId();
    if (!userId) throw new ForbiddenException();
    const student = await this.prisma.db.student.findUniqueOrThrow({
      where: { userId },
      select: { currentClassArmId: true },
    });
    return student.currentClassArmId;
  }
}
