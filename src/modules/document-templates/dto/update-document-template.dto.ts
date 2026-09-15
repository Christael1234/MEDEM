import { IsOptional, IsString } from 'class-validator';

export class UpdateDocumentTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  content?: string;
}
