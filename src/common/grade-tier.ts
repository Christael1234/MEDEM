import { GradeTier, SchoolLevel } from '@prisma/client';

/**
 * GradeTier is the admin-facing, finer-grained scoping field (splits
 * PRIMARY into Lower/Upper bands); SchoolLevel is kept alongside it on
 * SchoolClass purely because a lot of existing logic (Stream eligibility,
 * timetable period counts, promotion checks) already reads `level`. This
 * map is the single source of truth for deriving one from the other, so
 * `level` is never set independently and the two can never disagree.
 */
export const GRADE_TIER_TO_LEVEL: Record<GradeTier, SchoolLevel> = {
  NURSERY: 'NURSERY',
  LOWER_PRIMARY: 'PRIMARY',
  UPPER_PRIMARY: 'PRIMARY',
  JUNIOR_SECONDARY: 'JUNIOR_SECONDARY',
  SENIOR_SECONDARY: 'SENIOR_SECONDARY',
};

export function levelForGradeTier(tier: GradeTier): SchoolLevel {
  return GRADE_TIER_TO_LEVEL[tier];
}
