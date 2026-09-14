import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { StreamChangeRequestStatus, StudentStatus } from '@prisma/client';
import { AllowAnyAuthenticatedRole } from '../../common/rbac/decorators/allow-any-role.decorator';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { BulkPromoteDto } from './dto/bulk-promote.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { PromoteStudentDto } from './dto/promote-student.dto';
import { ReviewStreamChangeRequestDto } from './dto/review-stream-change-request.dto';
import { SetStudentStreamDto } from './dto/set-student-stream.dto';
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

  // Must come before ':id' below — Nest matches routes in declaration
  // order, so a literal 'promotion-preview' segment has to be registered
  // first or it would be swallowed as an :id value.
  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Get('promotion-preview')
  previewPromotion(
    @Query('classArmId') classArmId: string,
    @Query('targetAcademicSessionId') targetAcademicSessionId: string,
  ) {
    return this.studentsService.previewPromotion(classArmId, targetAcademicSessionId);
  }

  // Same route-order reasoning as 'promotion-preview' above — 'stream-requests'
  // has to be declared before ':id' or it gets swallowed as an id value.
  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Get('stream-requests')
  listStreamRequests(@Query('status') status?: StreamChangeRequestStatus) {
    return this.studentsService.listStreamChangeRequests(status);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Patch('stream-requests/:id/review')
  reviewStreamRequest(@Param('id') id: string, @Body() dto: ReviewStreamChangeRequestDto) {
    return this.studentsService.reviewStreamChangeRequest(id, dto.approve, dto.reviewNote);
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
  @Patch(':id/stream')
  setStream(@Param('id') id: string, @Body() dto: SetStudentStreamDto) {
    return this.studentsService.setStream(id, dto.stream);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Post(':id/promote')
  promote(@Param('id') id: string, @Body() dto: PromoteStudentDto) {
    return this.studentsService.promote(id, dto);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Post('promote-bulk')
  bulkPromote(@Body() dto: BulkPromoteDto) {
    return this.studentsService.bulkPromote(dto);
  }
}
