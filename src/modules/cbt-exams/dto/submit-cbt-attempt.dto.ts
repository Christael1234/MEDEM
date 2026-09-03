import { Type } from 'class-transformer';
import { ArrayMinSize, IsOptional, IsString, ValidateNested } from 'class-validator';

class CbtAnswerInputDto {
  @IsString()
  questionId!: string;

  @IsOptional()
  @IsString()
  selectedOptionId?: string;
}

export class SubmitCbtAttemptDto {
  @ValidateNested({ each: true })
  @Type(() => CbtAnswerInputDto)
  @ArrayMinSize(1)
  answers!: CbtAnswerInputDto[];
}
