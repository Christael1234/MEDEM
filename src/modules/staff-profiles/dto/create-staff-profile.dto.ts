import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateStaffProfileDto {
  @IsString()
  userId!: string;

  @IsString()
  campusId!: string;

  @IsOptional()
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsDateString()
  dateJoined?: string;
}
