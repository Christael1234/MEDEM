import { StudentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateStudentStatusDto {
  @IsEnum(StudentStatus)
  status!: StudentStatus;
}
