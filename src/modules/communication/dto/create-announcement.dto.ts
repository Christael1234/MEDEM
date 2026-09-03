import { AnnouncementAudience } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateAnnouncementDto {
  @IsEnum(AnnouncementAudience)
  audience!: AnnouncementAudience;

  /** Interpreted per `audience`: a Campus id for CAMPUS, a ClassArm id for
   * CLASS/ARM, a Guardian id for PARENT_GROUP, a User id for INDIVIDUAL.
   * Not required for SCHOOL. */
  @IsOptional()
  @IsString()
  audienceRefId?: string;

  @IsOptional()
  @IsString()
  campusId?: string;

  @IsString()
  title!: string;

  @IsString()
  body!: string;
}
