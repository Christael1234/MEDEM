import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateGradeBandDto {
  @IsString()
  grade!: string;

  @IsInt()
  @Min(0)
  minScore!: number;

  @IsInt()
  @Max(1000)
  maxScore!: number;

  @IsOptional()
  @IsString()
  meaning?: string;
}
