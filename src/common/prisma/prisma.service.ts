import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RequestContextService } from '../context/request-context';
import { tenantScopingExtension } from './tenant-scoping.extension';

/** Inferred from a concrete call rather than `PrismaClient['$extends']`
 * directly: the latter widens to the generic overload signature and
 * loses every model delegate's type, so every `prisma.db.xyz` call comes
 * back `unknown`. Binding through a real function call keeps the
 * extension's actual return type. */
function extendClient(client: PrismaClient, requestContext: RequestContextService) {
  return client.$extends(tenantScopingExtension(requestContext));
}

/**
 * Wraps a single underlying PrismaClient connection with two entry points:
 *
 * - `db`   : tenant-scoped client. Use this everywhere by default; it
 *            auto-injects/validates tenantId from the request context and
 *            throws if that context is missing for a tenant-owned model.
 * - `raw`  : unscoped client. Only for deliberate cross-tenant/platform
 *            code paths: pre-auth login lookup by email, Super Admin tenant
 *            provisioning, and the seed script. Every use of `raw` on a
 *            tenant-owned model is a spot that must be manually reviewed
 *            for correct scoping.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly raw: PrismaClient;
  readonly db: ReturnType<typeof extendClient>;

  constructor(requestContext: RequestContextService) {
    this.raw = new PrismaClient();
    this.db = extendClient(this.raw, requestContext);
  }

  async onModuleInit() {
    await this.raw.$connect();
  }

  async onModuleDestroy() {
    await this.raw.$disconnect();
  }
}
