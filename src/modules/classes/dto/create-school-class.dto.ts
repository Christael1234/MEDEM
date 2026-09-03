import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateSchoolClassDto {
  @IsString()
  campusId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  order?: number;
}
