import { IsBoolean, IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export class UpdateTenantBrandingDto {
  // The school's display name, shown in the sidebar and login pages —
  // not the same as Tenant.slug, which never changes once provisioned.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Matches(HEX_COLOR, { message: 'primaryColor must be a hex color, e.g. #176a50' })
  primaryColor?: string;

  @IsOptional()
  @Matches(HEX_COLOR, { message: 'sidebarColor must be a hex color, e.g. #123a31' })
  sidebarColor?: string;

  // A pasted image URL: there's no file-upload/storage module yet (see
  // CLAUDE.md's Phase 0 file-storage note), so this is the honest
  // scoped-down version rather than a fake "upload" button.
  @IsOptional()
  @IsUrl({}, { message: 'logoUrl must be a valid URL' })
  logoUrl?: string;

  // Removes the logo (falls back to the initials mark) — a separate flag
  // rather than accepting an empty logoUrl, since @IsUrl would reject "".
  @IsOptional()
  @IsBoolean()
  clearLogo?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  loginHeadline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  loginSubtext?: string;
}
