import { GradeTier, Stream } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(GradeTier, { each: true })
  gradeTiers?: GradeTier[];

  @IsOptional()
  @IsArray()
  @IsEnum(Stream, { each: true })
  streams?: Stream[];

  @IsOptional()
  @IsBoolean()
  isCompulsory?: boolean;

  @IsOptional()
  @IsBoolean()
  isCoreTrade?: boolean;
}
