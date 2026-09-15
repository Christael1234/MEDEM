import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { hasCampusAccess } from '../campus-access';
import { REQUIRE_SCOPE_KEY, ScopeOptions } from '../decorators/require-scope.decorator';

/**
 * Opt-in via @RequireScope(): most routes aren't campus-scoped, so this
 * guard passes through unless the route explicitly declares the check.
 * Looks for the campusId in params, then body, then query.
 */
@Injectable()
export class CampusScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<ScopeOptions | undefined>(
      REQUIRE_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!options) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role: Role; campusIds: string[] } | undefined;
    if (!user) throw new ForbiddenException('No authenticated user');

    const param = options.param ?? 'campusId';
    const campusId: string | undefined =
      request.params?.[param] ?? request.body?.[param] ?? request.query?.[param];

    if (!campusId) {
      throw new ForbiddenException(`Route requires campus scope but no '${param}' was provided`);
    }

    if (!hasCampusAccess(user, campusId)) {
      throw new ForbiddenException('No access to this campus');
    }

    return true;
  }
}
