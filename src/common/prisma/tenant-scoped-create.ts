/**
 * Type-only bridge: the tenant-scoping extension injects `tenantId` into
 * every tenant-scoped `create` call at runtime (see
 * tenant-scoping.extension.ts), so callers never set it themselves, but
 * Prisma's generated `*UncheckedCreateInput` types still require it at
 * compile time. Wrapping a data literal here satisfies TypeScript without
 * fabricating a real value; the actual tenantId is supplied later by the
 * extension, never by this function.
 */
export function tenantScopedCreate<T extends object>(data: T): T & { tenantId: string } {
  return data as T & { tenantId: string };
}
