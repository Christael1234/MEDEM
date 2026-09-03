import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateResultDto {
  @IsString()
  studentId!: string;

  @IsString()
  subjectId!: string;

  @IsString()
  academicSessionId!: string;

  @IsString()
  termId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  continuousAssessmentScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  examScore?: number;

  @IsOptional()
  @IsString()
  teacherComment?: string;
}
