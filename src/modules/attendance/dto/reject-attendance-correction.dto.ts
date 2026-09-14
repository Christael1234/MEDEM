import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

export class RejectAttendanceCorrectionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  reason!: string;
}
