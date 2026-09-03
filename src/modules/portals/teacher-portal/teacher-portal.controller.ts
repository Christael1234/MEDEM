import { Controller, ForbiddenException, Get, Query } from '@nestjs/common';
import { Roles } from '../../../common/rbac/decorators/roles.decorator';
import { RequestContextService } from '../../../common/context/request-context';
import { ClassesService } from '../../classes/classes.service';
import { StaffProfilesService } from '../../staff-profiles/staff-profiles.service';
import { StudentsService } from '../../students/students.service';
import { SubjectsService } from '../../subjects/subjects.service';

/**
 * Thin read-side aggregation over Phase 0/1 services — not a new source
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
    // "all my classes" when omitted) — no need to re-check here.
    return this.students.list({ classArmId });
  }

  @Roles('TEACHER')
  @Get('class-arms')
  myClassArms() {
    // Labelled version of the same set StudentsService/AssignmentsService
    // scope against — for UI pickers ("which class am I posting to").
    return this.classes.listDetailedArmsForCurrentTeacher();
  }

  @Roles('TEACHER')
  @Get('timetable')
  myTimetable() {
    // No Timetable model exists in Phase 0/1 — an honest stub rather than
    // fabricated schedule data (Phase 4 doc's non-goals section).
    return { entries: [], note: 'Timetable data source not yet built (Phase 1 scope).' };
  }
}
