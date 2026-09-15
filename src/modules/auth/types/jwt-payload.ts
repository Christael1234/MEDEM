import { Role } from '@prisma/client';

/** Claims signed into the access token. Everything TenantContextInterceptor
 * and the RBAC guards rely on comes from here, never from the client. */
export interface JwtAccessPayload {
  sub: string; // userId
  tenantId: string | null;
  role: Role;
  campusIds: string[];
}

/** What JwtStrategy.validate() attaches to request.user. */
export interface AuthenticatedUser {
  userId: string;
  tenantId: string | null;
  role: Role;
  campusIds: string[];
}
