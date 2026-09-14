import { Stream } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateClassArmDto {
  @IsString()
  schoolClassId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  classTeacherId?: string;

  /** Which Senior Secondary stream this arm is for — only meaningful when
   * the parent class is SENIOR_SECONDARY; irrelevant (and ignored by
   * random-arm-assignment) otherwise. */
  @IsOptional()
  @IsEnum(Stream)
  stream?: Stream;
}
