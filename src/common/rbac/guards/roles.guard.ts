import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ALLOW_ANY_ROLE_KEY } from '../decorators/allow-any-role.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Fails closed: every protected route must carry either @Roles(...) or
 * @AllowAnyAuthenticatedRole(). A route with neither is a bug, not an
 * open endpoint. This is what "deny by default" (CLAUDE.md rule #3)
 * means in practice.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const allowAnyRole = this.reflector.getAllAndOverride<boolean>(ALLOW_ANY_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role: Role } | undefined;
    if (!user) {
      throw new ForbiddenException('No authenticated user');
    }

    if (allowAnyRole) return true;

    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException(
        `${request.method} ${request.url} declares no @Roles() or @AllowAnyAuthenticatedRole(), access denied by default`,
      );
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`Role ${user.role} is not permitted to perform this action`);
    }

    return true;
  }
}
