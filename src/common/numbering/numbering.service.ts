import { ForbiddenException, Injectable } from '@nestjs/common';
import { RequestContextService } from '../context/request-context';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Atomically allocates gap-free-per-scope numbers backed by
 * NumberingSequence — student IDs, invoice numbers, receipt numbers,
 * payroll run numbers (the latter three land in later phases but should
 * consume this rather than inventing their own counter, per CLAUDE.md).
 */
@Injectable()
export class NumberingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async next(scope: string, prefix = '', pad = 6): Promise<string> {
    const tenantId = this.requestContext.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Numbering sequences require a tenant context');
    }

    const seq = await this.prisma.db.numberingSequence.upsert({
      where: { tenantId_scope: { tenantId, scope } },
      create: { tenantId, scope, prefix, nextValue: 2 },
      update: { nextValue: { increment: 1 } },
    });

    const claimedValue = seq.nextValue - 1;
    return `${seq.prefix}${String(claimedValue).padStart(pad, '0')}`;
  }
}
