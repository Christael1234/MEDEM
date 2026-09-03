import { SetMetadata } from '@nestjs/common';

export const REQUIRE_SCOPE_KEY = 'requireScope';

export interface ScopeOptions {
  /** Name of the campusId field to check, looked up in params, then body,
   * then query, in that order. */
  param?: string;
}

/** Marks a route as campus-scoped: CampusScopeGuard will verify the
 * caller's campusIds (from JWT) cover the campusId found on the request. */
export const RequireScope = (options: ScopeOptions = {}) =>
  SetMetadata(REQUIRE_SCOPE_KEY, { param: 'campusId', ...options });
