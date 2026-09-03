import { IsOptional, IsString } from 'class-validator';

export class CreateLessonDto {
  @IsString()
  classArmId!: string;

  @IsString()
  subjectId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
