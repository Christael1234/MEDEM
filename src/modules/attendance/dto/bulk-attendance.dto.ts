import { Type } from 'class-transformer';
import { AttendanceStatus } from '@prisma/client';
import { ArrayMinSize, IsDateString, IsEnum, IsString, ValidateNested } from 'class-validator';

class AttendanceEntryDto {
  @IsString()
  studentId!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;
}

export class BulkAttendanceDto {
  @IsString()
  classArmId!: string;

  @IsString()
  termId!: string;

  @IsDateString()
  date!: string;

  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  @ArrayMinSize(1)
  entries!: AttendanceEntryDto[];
}
