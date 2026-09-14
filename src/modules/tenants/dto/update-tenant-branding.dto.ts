import { IsOptional, Matches } from 'class-validator';

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export class UpdateTenantBrandingDto {
  @IsOptional()
  @Matches(HEX_COLOR, { message: 'primaryColor must be a hex color, e.g. #176a50' })
  primaryColor?: string;

  @IsOptional()
  @Matches(HEX_COLOR, { message: 'sidebarColor must be a hex color, e.g. #123a31' })
  sidebarColor?: string;
}
