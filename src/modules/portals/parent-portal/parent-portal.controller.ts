import { Controller, ForbiddenException, Get, Param } from '@nestjs/common';
import { Roles } from '../../../common/rbac/decorators/roles.decorator';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AssignmentsService } from '../../assignments/assignments.service';
import { AttendanceService } from '../../attendance/attendance.service';
import { GuardiansService } from '../../guardians/guardians.service';
import { ResultsService } from '../../results/results.service';
import { StudentsService } from '../../students/students.service';
import { TimetableService } from '../../timetable/timetable.service';

/**
 * Multi-child aware: GuardiansService.myChildren() resolves every linked
 * child via StudentGuardian from the session: a parent with three kids
 * gets one login and a switcher, not three logins (Phase 4 doc, build
 * order step 5).
 */
@Controller('portal/parent')
export class ParentPortalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guardians: GuardiansService,
    private readonly students: StudentsService,
    private readonly results: ResultsService,
    private readonly attendance: AttendanceService,
    private readonly assignments: AssignmentsService,
    private readonly timetable: TimetableService,
  ) {}

  @Roles('PARENT')
  @Get('children')
  myChildren() {
    return this.guardians.myChildren();
  }

  @Roles('PARENT')
  @Get('children/:studentId/results')
  childResults(@Param('studentId') studentId: string) {
    // ResultsService.list checks studentId against the parent's own
    // linked children and forces PUBLISHED-only.
    return this.results.list({ studentId });
  }

  @Roles('PARENT')
  @Get('children/:studentId/attendance')
  childAttendance(@Param('studentId') studentId: string) {
    return this.attendance.list({ studentId });
  }

  @Roles('PARENT')
  @Get('children/:studentId/timetable')
  async childTimetable(@Param('studentId') studentId: string) {
    await this.assertOwnChild(studentId);
    return this.timetable.getForStudent(studentId);
  }

  @Roles('PARENT')
  @Get('children/:studentId/assignments')
  async childAssignments(@Param('studentId') studentId: string) {
    // Assignment has no per-student scoping of its own (it's scoped by
    // class arm), verify the child belongs to this parent *before*
    // touching the student's classArmId, rather than letting an arbitrary
    // studentId reveal which class a stranger's child is in.
    await this.assertOwnChild(studentId);

    const student = await this.prisma.db.student.findUniqueOrThrow({
      where: { id: studentId },
      select: { currentClassArmId: true },
    });
    if (!student.currentClassArmId) return [];
    return this.assignments.listForClassArm(student.currentClassArmId);
  }

  private async assertOwnChild(studentId: string): Promise<void> {
    const allowedIds = await this.students.assignmentScopedStudentIds();
    if (!allowedIds.includes(studentId)) {
      throw new ForbiddenException('No access to this student record');
    }
  }
}
