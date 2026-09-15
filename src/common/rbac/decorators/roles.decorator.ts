import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Explicit role allowlist for a route. Required on every protected route
 * unless @AllowAnyAuthenticatedRole() is used instead; RolesGuard fails
 * closed when neither is present (CLAUDE.md rule #3: deny by default). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
