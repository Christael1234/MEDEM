import { SchoolLevel } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateSchoolClassDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(SchoolLevel)
  level?: SchoolLevel;

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
