import { AttendanceStatus } from '@prisma/client';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class CorrectAttendanceDto {
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsString()
  @MinLength(3)
  correctionReason!: string;
}
