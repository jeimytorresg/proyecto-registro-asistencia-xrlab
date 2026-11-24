import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ApiError } from '../common/api-error';
import type { UserRole } from '../common/roles';
import { TokenService } from './token.service';
import { toPublicProfile, UsersRepository, type UserProfile } from './users.repository';

export const ROLES_KEY = 'xrlab:roles';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  profile: UserProfile;
}

export type AuthenticatedRequest = Request & { authUser?: AuthenticatedUser };

function getBearerToken(request: Request): string {
  const header = request.header('Authorization');

  if (!header?.startsWith('Bearer ')) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Debe iniciar sesión para acceder a este recurso.');
  }

  const token = header.slice('Bearer '.length).trim();

  if (!token) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'El token de autenticación está vacío.');
  }

  return token;
}

/**
 * Valida el JWT de acceso y, como en el backend anterior, contrasta con el perfil activo en la BD:
 * un usuario desactivado o con otro rol pierde acceso aunque su token no haya vencido.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly users: UsersRepository,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const payload = await this.tokens.verifyAccessToken(getBearerToken(request));

    if (!payload) {
      throw new ApiError(401, 'AUTH_INVALID_TOKEN', 'La sesión no es válida o el token expiró.');
    }

    const user = await this.users.findById(payload.sub);

    if (!user?.active) {
      throw new ApiError(403, 'ROLE_FORBIDDEN', 'El usuario no tiene un perfil activo en XRLAB.');
    }

    if (user.role !== payload.role) {
      throw new ApiError(403, 'ROLE_FORBIDDEN', 'El rol de la sesión no coincide con el perfil registrado en XRLAB.');
    }

    const allowedRoles = this.reflector.getAllAndOverride<readonly UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
      throw new ApiError(403, 'ROLE_FORBIDDEN', 'No tiene permisos para acceder a este recurso.');
    }

    request.authUser = { id: user.id, email: user.email, role: user.role, profile: toPublicProfile(user) };

    return true;
  }
}
