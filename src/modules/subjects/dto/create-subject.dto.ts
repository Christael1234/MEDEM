import { GradeTier, Stream } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  /** Which grade tier(s) this subject is taught at: drives which classes
   * it can be assigned to (SubjectsService.assignTeacher) and which
   * subjects show up when building a class's curriculum at a given tier. */
  @IsArray()
  @IsEnum(GradeTier, { each: true })
  gradeTiers!: GradeTier[];

  /** Which Senior Secondary stream(s) this subject belongs to. Required
   * (non-empty) for a Senior Secondary subject that isn't compulsory or a
   * core trade subject — SubjectsService enforces this — since a
   * student's stream is what decides which electives they're offered. */
  @IsOptional()
  @IsArray()
  @IsEnum(Stream, { each: true })
  streams?: Stream[];

  /** Auto-included in every Senior Secondary student's subject selection,
   * regardless of `streams` (e.g. English Language). Mutually exclusive
   * with `isCoreTrade`. */
  @IsOptional()
  @IsBoolean()
  isCompulsory?: boolean;

  /** One of these is required in every Senior Secondary student's
   * selection (their choice of trade), independent of `streams`. Mutually
   * exclusive with `isCompulsory`. */
  @IsOptional()
  @IsBoolean()
  isCoreTrade?: boolean;
}
