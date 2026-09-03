import { Type } from 'class-transformer';
import { ArrayMinSize, IsBoolean, IsInt, IsString, Min, ValidateNested } from 'class-validator';

class CbtOptionInputDto {
  @IsString()
  text!: string;

  @IsBoolean()
  isCorrect!: boolean;
}

class CbtQuestionInputDto {
  @IsString()
  text!: string;

  @ValidateNested({ each: true })
  @Type(() => CbtOptionInputDto)
  @ArrayMinSize(2)
  options!: CbtOptionInputDto[];
}

export class CreateCbtExamDto {
  @IsString()
  classArmId!: string;

  @IsString()
  subjectId!: string;

  @IsString()
  title!: string;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @ValidateNested({ each: true })
  @Type(() => CbtQuestionInputDto)
  @ArrayMinSize(1)
  questions!: CbtQuestionInputDto[];
}
