import { IsOptional, IsString } from 'class-validator';

export class PromoteStudentDto {
  @IsString()
  academicSessionId!: string;

  @IsString()
  classArmId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
