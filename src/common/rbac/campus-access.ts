import { Role } from '@prisma/client';

/**
 * PROPRIETOR with no explicit UserCampusScope rows has access to every
 * campus in their tenant (see schema comment on UserCampusScope). Every
 * other role with no scope rows has access to none: deny by default.
 */
export function hasCampusAccess(
  user: { role: Role; campusIds: string[] },
  campusId: string,
): boolean {
  if (user.role === 'SUPER_ADMIN') return false;
  if (user.role === 'PROPRIETOR' && user.campusIds.length === 0) return true;
  return user.campusIds.includes(campusId);
}
