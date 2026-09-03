import { IsDateString, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateAssignmentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  resourceUrl?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
