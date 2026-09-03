import { GuardianRelationship } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class LinkGuardianDto {
  @IsString()
  studentId!: string;

  @IsString()
  guardianId!: string;

  @IsEnum(GuardianRelationship)
  relationship!: GuardianRelationship;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
