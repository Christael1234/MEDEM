import { SchoolLevel, Stream } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  /** Which level(s) this subject is taught at: drives which classes it
   * can be assigned to (SubjectsService.assignTeacher) and which subjects
   * show up when building a class's curriculum at a given level. */
  @IsArray()
  @IsEnum(SchoolLevel, { each: true })
  levels!: SchoolLevel[];

  /** Which Senior Secondary stream(s) this subject belongs to. Empty/omitted
   * means "any stream": only meaningful when SENIOR_SECONDARY is among
   * levels; a subject not taught at SS just ignores this. */
  @IsOptional()
  @IsArray()
  @IsEnum(Stream, { each: true })
  streams?: Stream[];
}
