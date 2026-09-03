import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';

/**
 * Claims carried on every authenticated request, derived exclusively from
 * the verified JWT — never from request body/query/params (rule #2 in
 * CLAUDE.md). SUPER_ADMIN has tenantId = null.
 */
export interface RequestContextStore {
  userId: string;
  tenantId: string | null;
  role: Role;
  campusIds: string[];
}

/**
 * Request-scoped context backed by AsyncLocalStorage, populated once per
 * request by TenantContextInterceptor and read by the Prisma tenant-scoping
 * extension. This is what lets every downstream service call the database
 * without manually threading tenantId through every method signature.
 */
@Injectable()
export class RequestContextService {
  private readonly als = new AsyncLocalStorage<RequestContextStore>();

  run<T>(store: RequestContextStore, callback: () => T): T {
    return this.als.run(store, callback);
  }

  get(): RequestContextStore | undefined {
    return this.als.getStore();
  }

  getTenantId(): string | null {
    return this.get()?.tenantId ?? null;
  }

  getUserId(): string | undefined {
    return this.get()?.userId;
  }

  getRole(): Role | undefined {
    return this.get()?.role;
  }

  getCampusIds(): string[] {
    return this.get()?.campusIds ?? [];
  }
}
