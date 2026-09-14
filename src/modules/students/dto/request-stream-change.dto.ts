import { Stream } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class RequestStreamChangeDto {
  @IsEnum(Stream)
  requestedStream!: Stream;

  @IsOptional()
  @IsString()
  reason?: string;
}
