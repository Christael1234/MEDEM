import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Bypasses JwtAuthGuard and RolesGuard entirely. Only for routes that
 * must work with no session at all: login, refresh. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
