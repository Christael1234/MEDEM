import { Controller, ForbiddenException, Get, Query } from '@nestjs/common';
import { Roles } from '../../../common/rbac/decorators/roles.decorator';
import { RequestContextService } from '../../../common/context/request-context';
import { ClassesService } from '../../classes/classes.service';
import { StaffProfilesService } from '../../staff-profiles/staff-profiles.service';
import { StudentsService } from '../../students/students.service';
import { SubjectsService } from '../../subjects/subjects.service';
import { TimetableService } from '../../timetable/timetable.service';

/**
 * Thin read-side aggregation over Phase 0/1 services, not a new source
 * of truth. Every method reuses the scoping already enforced in
 * StudentsService/SubjectsService rather than re-implementing it.
 */
@Controller('portal/teacher')
export class TeacherPortalController {
  constructor(
    private readonly staffProfiles: StaffProfilesService,
    private readonly subjects: SubjectsService,
    private readonly students: StudentsService,
    private readonly classes: ClassesService,
    private readonly requestContext: RequestContextService,
    private readonly timetable: TimetableService,
  ) {}

  @Roles('TEACHER')
  @Get('classes')
  async myClasses() {
    const userId = this.requestContext.getUserId();
    if (!userId) throw new ForbiddenException();
    const staffProfile = await this.staffProfiles.findByUserId(userId);
    return this.subjects.listAssignmentsForStaff(staffProfile.id);
  }

  @Roles('TEACHER')
  @Get('students')
  myStudents(@Query('classArmId') classArmId?: string) {
    // StudentsService.list already restricts TEACHER to their assigned
    // class arms (throws if classArmId isn't one of them, or defaults to
    // "all my classes" when omitted), no need to re-check here.
    return this.students.list({ classArmId });
  }

  @Roles('TEACHER')
  @Get('class-arms')
  myClassArms() {
    // Labelled version of the same set StudentsService/AssignmentsService
    // scope against, for UI pickers ("which class am I posting to").
    return this.classes.listDetailedArmsForCurrentTeacher();
  }

  @Roles('TEACHER')
  @Get('class-teacher-arms')
  myClassTeacherArms() {
    // Narrower than class-arms above: only arms where this teacher is
    // the class teacher, not just a subject teacher. Backs the
    // attendance-taking picker (AttendanceService restricts taking/
    // correcting attendance to the class teacher only).
    return this.classes.listClassTeacherArmsForCurrentTeacher();
  }

  @Roles('TEACHER')
  @Get('timetable')
  myTimetable() {
    return this.timetable.getForCurrentTeacher();
  }
}
