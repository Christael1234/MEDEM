import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ReviewStreamChangeRequestDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
