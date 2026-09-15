import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateTeacherDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsString()
  campusId!: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsDateString()
  dateJoined?: string;

  /** If set, this teacher becomes the class teacher of this ClassArm.
   * Must belong to the same campus and must not already have a class
   * teacher, both enforced server-side in StaffProfilesService, never
   * trusted from the client. */
  @IsOptional()
  @IsString()
  classArmId?: string;
}
