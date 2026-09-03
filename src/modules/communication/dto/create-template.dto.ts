import { CommunicationChannel } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  name!: string;

  @IsEnum(CommunicationChannel)
  channel!: CommunicationChannel;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  placeholders?: string[];
}
