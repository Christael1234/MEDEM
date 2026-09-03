import { PrismaService } from '../prisma/prisma.service';

/** Standard demo/test password for every auto-generated portal login
 * (students, teachers). A deliberate, temporary convention for the
 * current build pass, not a production credential policy. */
export const DEFAULT_PORTAL_PASSWORD = 'password123';

/** Generates a human-readable, collision-safe login email from a person's
 * name — "maybe their name only" per the product decision, so it reads
 * like a real school-issued address rather than a random id. Collision
 * checks go through prisma.raw since User.email is unique tenant-wide,
 * not just within the caller's own tenant. */
export async function generateLoginEmail(
  prisma: PrismaService,
  tenantId: string,
  firstName: string,
  lastName: string,
  fallback = 'user',
): Promise<string> {
  const tenant = await prisma.raw.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const domain = `${tenant.slug.replace(/-schools?$/i, '') || tenant.slug}.test`;

  const base =
    `${firstName}.${lastName}`
      .toLowerCase()
      .normalize('NFKD')
      .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
      .replace(/[^a-z0-9.]+/g, '')
      .replace(/\.+/g, '.')
      .replace(/^\.|\.$/g, '') || fallback;

  let candidate = `${base}@${domain}`;
  let n = 1;
  while (await prisma.raw.user.findUnique({ where: { email: candidate } })) {
    n += 1;
    candidate = `${base}${n}@${domain}`;
  }
  return candidate;
}
