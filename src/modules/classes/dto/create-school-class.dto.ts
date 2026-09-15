import { GradeTier } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateSchoolClassDto {
  @IsString()
  campusId!: string;

  @IsString()
  name!: string;

  // SchoolLevel is derived from this (see ClassesService), never set
  // directly, so the two fields can never disagree.
  @IsEnum(GradeTier)
  gradeTier!: GradeTier;

  @IsOptional()
  @IsInt()
  order?: number;
}
