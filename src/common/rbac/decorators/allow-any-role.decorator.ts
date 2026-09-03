import { SetMetadata } from '@nestjs/common';

export const ALLOW_ANY_ROLE_KEY = 'allowAnyRole';

/** Deliberate escape hatch for routes any authenticated role may call
 * (e.g. "get my own profile"). Marks the choice as intentional rather
 * than an oversight — RolesGuard otherwise fails closed. */
export const AllowAnyAuthenticatedRole = () => SetMetadata(ALLOW_ANY_ROLE_KEY, true);
