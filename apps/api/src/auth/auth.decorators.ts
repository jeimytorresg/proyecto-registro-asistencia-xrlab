import { applyDecorators, createParamDecorator, type ExecutionContext, SetMetadata, UseGuards } from '@nestjs/common';
import type { UserRole } from '../common/roles';
import { type AuthenticatedRequest, type AuthenticatedUser, JwtAuthGuard, ROLES_KEY } from './jwt-auth.guard';

/** Exige sesión válida y, si se indican roles, que el usuario tenga alguno de ellos. Equivale a `requireAuth(roles)`. */
export const Auth = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  applyDecorators(SetMetadata(ROLES_KEY, roles), UseGuards(JwtAuthGuard));

/** Inyecta el usuario autenticado que dejó `JwtAuthGuard`. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedUser => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

  if (!request.authUser) {
    throw new Error('authUser no fue definido: falta el decorador @Auth().');
  }

  return request.authUser;
});
