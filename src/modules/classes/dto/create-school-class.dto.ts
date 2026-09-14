import { SchoolLevel } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateSchoolClassDto {
  @IsString()
  campusId!: string;

  @IsString()
  name!: string;

  @IsEnum(SchoolLevel)
  level!: SchoolLevel;

  @IsOptional()
  @IsInt()
  order?: number;
}
