import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role, ROLE_RANK } from '../enums/role.enum';

/**
 * Enforces role-based access. A user passes if their role rank is >= the lowest
 * required role rank (so SUPER_ADMIN can access ADMIN-only routes).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Authentication required');

    const userRank = ROLE_RANK[user.role as Role] ?? 0;
    const minRequired = Math.min(...required.map((r) => ROLE_RANK[r]));

    if (userRank < minRequired) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
