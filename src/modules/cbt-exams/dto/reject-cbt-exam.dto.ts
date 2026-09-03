import { IsString } from 'class-validator';

export class RejectCbtExamDto {
  @IsString()
  reason!: string;
}
