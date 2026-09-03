import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AllowAnyAuthenticatedRole } from '../../common/rbac/decorators/allow-any-role.decorator';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { AssignTeacherDto } from './dto/assign-teacher.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { SubjectsService } from './subjects.service';

@Controller()
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Post('subjects')
  createSubject(@Body() dto: CreateSubjectDto) {
    return this.subjectsService.createSubject(dto);
  }

  @AllowAnyAuthenticatedRole()
  @Get('subjects')
  listSubjects() {
    return this.subjectsService.listSubjects();
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Post('teacher-subject-assignments')
  assignTeacher(@Body() dto: AssignTeacherDto) {
    return this.subjectsService.assignTeacher(dto);
  }

  @AllowAnyAuthenticatedRole()
  @Get('classes/:id/teacher-subject-assignments')
  listForClass(@Param('id') id: string) {
    return this.subjectsService.listAssignmentsForClass(id);
  }

  @AllowAnyAuthenticatedRole()
  @Get('staff/:id/teacher-subject-assignments')
  listForStaff(@Param('id') id: string) {
    return this.subjectsService.listAssignmentsForStaff(id);
  }
}
