import { TermName } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateTermDto {
  @IsString()
  academicSessionId!: string;

  @IsEnum(TermName)
  name!: TermName;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}
