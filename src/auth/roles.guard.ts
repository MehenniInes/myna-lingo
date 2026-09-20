import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // no @Roles() on this route = anyone logged in can access
    }

    const { user } = context.switchToHttp().getRequest();
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role permissions');
    }
    return true;
  }
}