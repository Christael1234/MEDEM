import { IsOptional, IsString } from 'class-validator';

export class UpdateSchoolClassDto {
  @IsOptional()
  @IsString()
  name?: string;
}
