import { IsOptional, IsString } from 'class-validator';

export class UpdateClassArmDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  classTeacherId?: string;
}
