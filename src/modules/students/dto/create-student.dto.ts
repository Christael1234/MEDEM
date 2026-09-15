import { GuardianRelationship, StudentStatus } from '@prisma/client';
import { IsDateString, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  campusId!: string;

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

  @IsOptional()
  @IsString()
  currentClassArmId?: string;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  // Guardian 1 (required): either link an existing guardian (guardianId,
  // found via GET /guardians?search=) or provide a new one's name. Service
  // layer enforces "one of the two" since class-validator can't express an
  // OR-required constraint cleanly across two field groups.
  @IsOptional()
  @IsString()
  guardianId?: string;

  @IsOptional()
  @IsString()
  guardianFirstName?: string;

  @IsOptional()
  @IsString()
  guardianLastName?: string;

  @IsOptional()
  @IsEmail()
  guardianEmail?: string;

  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @IsEnum(GuardianRelationship)
  guardianRelationship!: GuardianRelationship;

  // Guardian 2, fully optional, same shape.
  @IsOptional()
  @IsString()
  secondGuardianId?: string;

  @IsOptional()
  @IsString()
  secondGuardianFirstName?: string;

  @IsOptional()
  @IsString()
  secondGuardianLastName?: string;

  @IsOptional()
  @IsEmail()
  secondGuardianEmail?: string;

  @IsOptional()
  @IsString()
  secondGuardianPhone?: string;

  @IsOptional()
  @IsEnum(GuardianRelationship)
  secondGuardianRelationship?: GuardianRelationship;
}
