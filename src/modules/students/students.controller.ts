import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { StudentStatus } from '@prisma/client';
import { AllowAnyAuthenticatedRole } from '../../common/rbac/decorators/allow-any-role.decorator';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { CreateStudentDto } from './dto/create-student.dto';
import { PromoteStudentDto } from './dto/promote-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateStudentStatusDto } from './dto/update-student-status.dto';
import { StudentsService } from './students.service';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Post()
  create(@Body() dto: CreateStudentDto) {
    return this.studentsService.create(dto);
  }

  @AllowAnyAuthenticatedRole()
  @Get()
  list(
    @Query('campusId') campusId?: string,
    @Query('classArmId') classArmId?: string,
    @Query('status') status?: StudentStatus,
  ) {
    return this.studentsService.list({ campusId, classArmId, status });
  }

  @AllowAnyAuthenticatedRole()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.studentsService.findOne(id);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.studentsService.update(id, dto);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStudentStatusDto) {
    return this.studentsService.updateStatus(id, dto.status);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Post(':id/promote')
  promote(@Param('id') id: string, @Body() dto: PromoteStudentDto) {
    return this.studentsService.promote(id, dto);
  }
}
