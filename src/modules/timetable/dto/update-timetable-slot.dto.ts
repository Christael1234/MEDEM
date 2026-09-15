import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateTimetableSlotDto {
  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  staffProfileId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  dayOfWeek?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  periodIndex?: number;
}
