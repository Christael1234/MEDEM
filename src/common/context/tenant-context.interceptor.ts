import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestContextService, RequestContextStore } from './request-context';

/**
 * Populates RequestContextService for the lifetime of the request, sourced
 * only from req.user (set by JwtStrategy after verifying the access token,
 * see CLAUDE.md rule #2: tenant/campus IDs never come from the client).
 *
 * Runs after guards (so req.user is already set on authenticated routes)
 * and wraps `next.handle()` itself (not just its subscription) because
 * Nest invokes the handler as soon as `next.handle()` is called, and
 * AsyncLocalStorage only propagates to async work started inside `.run()`.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly requestContext: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as
      | { userId: string; tenantId: string | null; role: string; campusIds?: string[] }
      | undefined;

    if (!user) {
      // Unauthenticated route (e.g. login): no tenant context to set.
      // Handlers on these routes must use PrismaService.raw explicitly.
      return next.handle();
    }

    const store: RequestContextStore = {
      userId: user.userId,
      tenantId: user.tenantId,
      role: user.role as RequestContextStore['role'],
      campusIds: user.campusIds ?? [],
    };

    return this.requestContext.run(store, () => next.handle());
  }
}
