import { SchoolLevel, Stream } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(SchoolLevel, { each: true })
  levels?: SchoolLevel[];

  @IsOptional()
  @IsArray()
  @IsEnum(Stream, { each: true })
  streams?: Stream[];
}
