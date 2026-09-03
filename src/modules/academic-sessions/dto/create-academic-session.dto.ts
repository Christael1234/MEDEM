import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateAcademicSessionDto {
  @IsString()
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}
