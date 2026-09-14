import { Stream } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SetStudentStreamDto {
  @IsEnum(Stream)
  stream!: Stream;
}
