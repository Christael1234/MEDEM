import { IsInt, IsString, Max, Min } from 'class-validator';

export class CreateTimetableSlotDto {
  @IsString()
  classArmId!: string;

  @IsString()
  subjectId!: string;

  @IsString()
  staffProfileId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  dayOfWeek!: number;

  @IsInt()
  @Min(0)
  periodIndex!: number;
}
