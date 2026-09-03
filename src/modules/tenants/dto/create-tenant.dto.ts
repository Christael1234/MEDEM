import { Type } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MinLength, ValidateNested } from 'class-validator';

class ProprietorDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;
}

export class CreateTenantDto {
  @IsString()
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase alphanumeric with hyphens' })
  slug!: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsString()
  campusName!: string;

  @ValidateNested()
  @Type(() => ProprietorDto)
  proprietor!: ProprietorDto;
}
