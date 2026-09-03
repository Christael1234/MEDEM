import { User } from '@prisma/client';

/** Strips secrets before a User row ever leaves the service layer. */
export function sanitizeUser(user: User) {
  const { passwordHash: _passwordHash, mfaSecret: _mfaSecret, ...safe } = user;
  return safe;
}
