import { IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateLessonResourceDto {
  @IsString()
  name!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;
}
