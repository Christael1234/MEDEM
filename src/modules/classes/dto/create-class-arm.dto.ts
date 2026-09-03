import { IsOptional, IsString } from 'class-validator';

export class CreateClassArmDto {
  @IsString()
  schoolClassId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  classTeacherId?: string;
}
