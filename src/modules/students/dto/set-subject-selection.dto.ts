import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class SetSubjectSelectionDto {
  @IsString()
  tradeSubjectId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  electiveSubjectIds!: string[];
}
