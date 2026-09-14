import { Type } from 'class-transformer';
import { ArrayMinSize, IsOptional, IsString, ValidateNested } from 'class-validator';

class PromotionAssignmentDto {
  @IsString()
  studentId!: string;

  /** Omitted/absent means this student graduates instead of moving to a
   * new class — there's no "next" class arm for them. */
  @IsOptional()
  @IsString()
  targetClassArmId?: string;
}

export class BulkPromoteDto {
  @IsString()
  classArmId!: string;

  @IsString()
  targetAcademicSessionId!: string;

  @ValidateNested({ each: true })
  @Type(() => PromotionAssignmentDto)
  @ArrayMinSize(1)
  assignments!: PromotionAssignmentDto[];
}
