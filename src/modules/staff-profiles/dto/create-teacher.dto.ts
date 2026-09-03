import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateTeacherDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsString()
  campusId!: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsDateString()
  dateJoined?: string;
}
