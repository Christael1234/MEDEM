import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestContextService } from '../context/request-context';

/**
 * Models that carry a direct `tenantId` column and must never be readable
 * or writable outside the caller's own tenant (CLAUDE.md rule #1).
 *
 * Models one hop away from tenantId (Term, ClassArm, TeacherSubjectAssignment,
 * StudentClassHistory, StudentGuardian, UserCampusScope, RefreshToken) are
 * NOT auto-scoped here — they must be reached through a tenant-scoped parent
 * (e.g. filter ClassArm via its SchoolClass) or explicitly scoped by the
 * calling service. Auto-scoping them would require guessing which nested
 * relation to filter on, which is worse than making the gap explicit.
 */
const TENANT_SCOPED_MODELS = new Set<Prisma.ModelName>([
  'Campus',
  'User',
  'AcademicSession',
  'SchoolClass',
  'Subject',
  'StaffProfile',
  'Student',
  'Guardian',
  'AttendanceRecord',
  'Result',
  'AuditLog',
  'NumberingSequence',
  'Notification',
  'MessageTemplate',
  'CommunicationLog',
  'Assignment',
  'Announcement',
  'Lesson',
  'CbtExam',
]);

const READ_OR_WHERE_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

function scopeWhere(where: unknown, tenantId: string) {
  const w = (where ?? {}) as Record<string, unknown>;
  if (w.tenantId !== undefined && w.tenantId !== tenantId) {
    throw new ForbiddenException('Cross-tenant access denied');
  }
  return { ...w, tenantId };
}

function scopeData(data: unknown, tenantId: string) {
  const d = (data ?? {}) as Record<string, unknown>;
  if (d.tenantId !== undefined && d.tenantId !== tenantId) {
    throw new ForbiddenException('Cannot write a record to a different tenant');
  }
  return { ...d, tenantId };
}

/**
 * Prisma Client extension: automatically injects/validates tenantId on
 * every query against a tenant-scoped model, sourced from the current
 * request's AsyncLocalStorage context — never from caller-supplied args.
 *
 * A missing tenant context on a tenant-scoped model is a hard error, not a
 * silent no-op filter — "deny by default" (CLAUDE.md rule #3).
 */
export function tenantScopingExtension(requestContext: RequestContextService) {
  return Prisma.defineExtension({
    name: 'tenant-scoping',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model as Prisma.ModelName)) {
            return query(args);
          }

          const tenantId = requestContext.getTenantId();
          if (!tenantId) {
            throw new ForbiddenException(
              `No tenant context for scoped model ${model}.${operation} — ` +
                'use PrismaService.raw for deliberate cross-tenant/platform operations.',
            );
          }

          const scopedArgs = args as Record<string, unknown>;

          if (READ_OR_WHERE_OPS.has(operation)) {
            scopedArgs.where = scopeWhere(scopedArgs.where, tenantId);
          } else if (operation === 'create') {
            scopedArgs.data = scopeData(scopedArgs.data, tenantId);
          } else if (operation === 'createMany') {
            const data = scopedArgs.data;
            scopedArgs.data = Array.isArray(data)
              ? data.map((item) => scopeData(item, tenantId))
              : data;
          } else if (operation === 'upsert') {
            scopedArgs.where = scopeWhere(scopedArgs.where, tenantId);
            scopedArgs.create = scopeData(scopedArgs.create, tenantId);
          }

          return query(scopedArgs as never);
        },
      },
    },
  });
}
