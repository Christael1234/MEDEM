import { Stream } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateClassArmDto {
  @IsOptional()
  @IsString()
  name?: string;

  /** Reassigns the class teacher. Ignored if removeClassTeacher is true. */
  @IsOptional()
  @IsString()
  classTeacherId?: string;

  /** Explicit clear: classTeacherId being merely absent means "don't
   * change it", so unassigning needs its own flag rather than overloading
   * undefined/null. */
  @IsOptional()
  @IsBoolean()
  removeClassTeacher?: boolean;

  /** Tags this arm as Science/Art (Senior Secondary only in practice).
   * Ignored if clearStream is true. */
  @IsOptional()
  @IsEnum(Stream)
  stream?: Stream;

  /** Explicit clear, same reasoning as removeClassTeacher. */
  @IsOptional()
  @IsBoolean()
  clearStream?: boolean;
}
