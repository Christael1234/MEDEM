import { IsString } from 'class-validator';

export class AssignTeacherDto {
  @IsString()
  staffProfileId!: string;

  @IsString()
  schoolClassId!: string;

  @IsString()
  subjectId!: string;
}
