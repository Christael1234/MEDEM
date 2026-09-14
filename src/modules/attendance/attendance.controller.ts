import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AllowAnyAuthenticatedRole } from '../../common/rbac/decorators/allow-any-role.decorator';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { AttendanceService } from './attendance.service';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';
import { CorrectAttendanceDto } from './dto/correct-attendance.dto';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { RejectAttendanceCorrectionDto } from './dto/reject-attendance-correction.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Roles('PROPRIETOR', 'PRINCIPAL', 'TEACHER')
  @Post()
  record(@Body() dto: CreateAttendanceDto) {
    return this.attendanceService.record(dto);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL', 'TEACHER')
  @Post('bulk')
  recordBulk(@Body() dto: BulkAttendanceDto) {
    return this.attendanceService.recordBulk(dto);
  }

  // Must come before ':id/correct' etc. so Nest doesn't try to match
  // "pending-corrections" as an :id.
  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Get('pending-corrections')
  pendingCorrections() {
    return this.attendanceService.listPendingCorrections();
  }

  @Roles('PROPRIETOR', 'PRINCIPAL', 'TEACHER')
  @Patch(':id/correct')
  correct(@Param('id') id: string, @Body() dto: CorrectAttendanceDto) {
    return this.attendanceService.correct(id, dto.status, dto.correctionReason);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Patch(':id/approve-correction')
  approveCorrection(@Param('id') id: string) {
    return this.attendanceService.approveCorrection(id);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Patch(':id/reject-correction')
  rejectCorrection(@Param('id') id: string, @Body() dto: RejectAttendanceCorrectionDto) {
    return this.attendanceService.rejectCorrection(id, dto.reason);
  }

  @AllowAnyAuthenticatedRole()
  @Get()
  list(
    @Query('classArmId') classArmId?: string,
    @Query('studentId') studentId?: string,
    @Query('termId') termId?: string,
    @Query('date') date?: string,
  ) {
    return this.attendanceService.list({ classArmId, studentId, termId, date });
  }
}
