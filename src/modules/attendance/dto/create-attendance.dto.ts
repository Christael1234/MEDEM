import { AttendanceStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsString } from 'class-validator';

export class CreateAttendanceDto {
  @IsString()
  studentId!: string;

  @IsString()
  classArmId!: string;

  @IsString()
  termId!: string;

  @IsDateString()
  date!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;
}
