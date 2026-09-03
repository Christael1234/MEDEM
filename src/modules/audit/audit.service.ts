import { Injectable } from '@nestjs/common';
import { RequestContextService } from '../../common/context/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface AuditLogParams {
  action: string;
  entityType: string;
  entityId: string;
  before?: object | null;
  after?: object | null;
}

/**
 * Canonical writer for the AuditLog table (CLAUDE.md rule #5: payments,
 * payroll actions, results, permission changes, and sensitive profile
 * changes must be audited). Writes via PrismaService.raw deliberately —
 * AuditLog.tenantId is nullable for platform-level (SUPER_ADMIN) actions,
 * which the tenant-scoping extension would otherwise reject outright.
 * tenantId/actorId still come only from RequestContextService, never from
 * caller-supplied params, so this doesn't reopen rule #2.
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async log(params: AuditLogParams): Promise<void> {
    await this.prisma.raw.auditLog.create({
      data: {
        tenantId: this.requestContext.getTenantId(),
        actorId: this.requestContext.getUserId() ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        before: params.before ?? undefined,
        after: params.after ?? undefined,
      },
    });
  }
}
