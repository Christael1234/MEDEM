import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { Roles } from '../../../common/rbac/decorators/roles.decorator';
import { RequestContextService } from '../../../common/context/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AssignmentsService } from '../../assignments/assignments.service';
import { AttendanceService } from '../../attendance/attendance.service';
import { ResultsService } from '../../results/results.service';

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
    return { entries: [], note: 'Timetable data source not yet built (Phase 1 scope).' };
  }

  @Roles('STUDENT')
  @Get('me')
  async myProfile() {
    const userId = this.requestContext.getUserId();
    if (!userId) throw new ForbiddenException();
    return this.prisma.db.student.findUniqueOrThrow({
      where: { userId },
      include: {
        currentClassArm: { include: { schoolClass: { select: { name: true } } } },
        guardianLinks: {
          include: { guardian: { select: { firstName: true, lastName: true, phone: true, email: true } } },
        },
      },
    });
  }

  @Roles('STUDENT')
  @Get('subjects')
  async mySubjects() {
    const classArmId = await this.myClassArmId();
    if (!classArmId) return [];

    // TeacherSubjectAssignment is keyed by SchoolClass, not ClassArm —
    // resolve the parent class first (same pattern as
    // ClassesService.assertTeacherCanActOnArm).
    const schoolClass = await this.prisma.db.schoolClass.findFirstOrThrow({
      where: { arms: { some: { id: classArmId } } },
      select: { id: true },
    });

    return this.prisma.db.teacherSubjectAssignment.findMany({
      where: { schoolClassId: schoolClass.id },
      include: {
        subject: { select: { name: true } },
        staffProfile: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
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
