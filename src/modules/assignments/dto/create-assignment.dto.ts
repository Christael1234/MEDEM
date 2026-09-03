import { IsDateString, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateAssignmentDto {
  @IsString()
  classArmId!: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  resourceUrl?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
