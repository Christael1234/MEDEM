import { IsOptional, IsString } from 'class-validator';

export class CreateCampusDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  address?: string;
}
