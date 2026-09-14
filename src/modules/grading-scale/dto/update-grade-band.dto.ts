import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateGradeBandDto {
  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minScore?: number;

  @IsOptional()
  @IsInt()
  @Max(1000)
  maxScore?: number;

  @IsOptional()
  @IsString()
  meaning?: string;
}
