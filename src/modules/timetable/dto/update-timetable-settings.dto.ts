import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class TimetableBreakDto {
  @IsString()
  label!: string;

  @Matches(HHMM, { message: 'startTime must be 24h HH:mm' })
  startTime!: string;

  @Matches(HHMM, { message: 'endTime must be 24h HH:mm' })
  endTime!: string;
}

export class UpdateTimetableSettingsDto {
  @IsOptional()
  @Matches(HHMM, { message: 'dayStartTime must be 24h HH:mm' })
  dayStartTime?: string;

  @IsOptional()
  @Matches(HHMM, { message: 'dayEndTime must be 24h HH:mm' })
  dayEndTime?: string;

  /** Full replacement — the whole list is re-created on every save, same
   * "replace, don't merge" rule as the timetable itself (a break list is a
   * small, admin-curated set, not something appended to incrementally). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimetableBreakDto)
  breaks?: TimetableBreakDto[];
}
