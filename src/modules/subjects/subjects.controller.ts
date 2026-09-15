import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { GradeTier, Stream } from '@prisma/client';
import { AllowAnyAuthenticatedRole } from '../../common/rbac/decorators/allow-any-role.decorator';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { AssignTeacherDto } from './dto/assign-teacher.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { SubjectsService } from './subjects.service';

@Controller()
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Post('subjects')
  createSubject(@Body() dto: CreateSubjectDto) {
    return this.subjectsService.createSubject(dto);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Patch('subjects/:id')
  updateSubject(@Param('id') id: string, @Body() dto: UpdateSubjectDto) {
    return this.subjectsService.updateSubject(id, dto);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Delete('subjects/:id')
  @HttpCode(204)
  deleteSubject(@Param('id') id: string) {
    return this.subjectsService.deleteSubject(id);
  }

  @AllowAnyAuthenticatedRole()
  @Get('subjects')
  listSubjects(@Query('gradeTier') gradeTier?: GradeTier, @Query('stream') stream?: Stream) {
    return this.subjectsService.listSubjects(gradeTier, stream);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Post('teacher-subject-assignments')
  assignTeacher(@Body() dto: AssignTeacherDto) {
    return this.subjectsService.assignTeacher(dto);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Post('teacher-subject-assignments/reassign')
  reassignTeacher(@Body() dto: AssignTeacherDto) {
    return this.subjectsService.reassignTeacher(dto);
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

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Delete('teacher-subject-assignments/:id')
  @HttpCode(204)
  removeAssignment(@Param('id') id: string) {
    return this.subjectsService.removeAssignment(id);
  }
}
