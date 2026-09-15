import { Type } from 'class-transformer';
import { ArrayMinSize, ArrayMaxSize, IsDateString, IsEmail, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { GuardianRelationship } from '@prisma/client';

/** One CSV row, already parsed to JSON client-side. Class/arm/campus are
 * matched by name (not id) since a spreadsheet a school is migrating
 * from has no idea what SchoolOS's internal ids are; the service layer
 * resolves each name against this tenant's real records per-row so one
 * bad row never affects the ones around it. */
class BulkImportStudentRowDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsString()
  campusName!: string;

  @IsOptional()
  @IsString()
  className?: string;

  @IsOptional()
  @IsString()
  armName?: string;

  @IsString()
  guardianFirstName!: string;

  @IsString()
  guardianLastName!: string;

  @IsOptional()
  @IsEmail()
  guardianEmail?: string;

  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @IsOptional()
  @IsEnum(GuardianRelationship)
  guardianRelationship?: GuardianRelationship;
}

export class BulkImportStudentsDto {
  @ValidateNested({ each: true })
  @Type(() => BulkImportStudentRowDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  rows!: BulkImportStudentRowDto[];
}
