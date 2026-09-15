import { GradeTier } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateSchoolClassDto {
  @IsOptional()
  @IsString()
  name?: string;

  // SchoolLevel is derived from this (see ClassesService), never set
  // directly, so the two fields can never disagree.
  @IsOptional()
  @IsEnum(GradeTier)
  gradeTier?: GradeTier;

  @IsOptional()
  @IsInt()
  order?: number;

  /** The next class in the promotion chain (e.g. JSS 1 -> JSS 2). Omitted
   * means "don't change it"; clearPromotesTo is the explicit way to unset
   * it (mark this class terminal, students graduate out of it), same
   * remove-flag pattern as UpdateClassArmDto.removeClassTeacher. */
  @IsOptional()
  @IsString()
  promotesToClassId?: string;

  @IsOptional()
  @IsBoolean()
  clearPromotesTo?: boolean;
}
