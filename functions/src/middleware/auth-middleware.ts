import type { DecodedIdToken } from 'firebase-admin/auth';
import type { NextFunction, Request, Response } from 'express';
import { adminAuth } from '../config/firebase-admin.js';
import { isUserRole, type UserRole } from '../domain/roles.js';
import { ApiError } from '../http/api-error.js';
import {
  findUserProfileByFirebaseUid,
  updateLastLoginAt,
  type UserProfile,
} from '../repositories/users.repository.js';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  role: UserRole;
  profile: UserProfile;
  token: DecodedIdToken;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}

function getBearerToken(req: Request): string {
  const authorizationHeader = req.header('Authorization');

  if (!authorizationHeader?.startsWith('Bearer ')) {
    throw new ApiError(
      401,
      'AUTH_REQUIRED',
      'Debe iniciar sesión para acceder a este recurso.',
    );
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();

  if (!token) {
    throw new ApiError(
      401,
      'AUTH_REQUIRED',
      'El token de autenticación está vacío.',
    );
  }

  return token;
}

function getRoleFromToken(decodedToken: DecodedIdToken): UserRole {
  const role = decodedToken['role'];

  if (!isUserRole(role)) {
    throw new ApiError(
      403,
      'ROLE_FORBIDDEN',
      'El usuario autenticado no tiene un rol válido asignado.',
    );
  }

  return role;
}

async function verifyFirebaseToken(req: Request): Promise<DecodedIdToken> {
  const bearerToken = getBearerToken(req);

  try {
    return await adminAuth.verifyIdToken(bearerToken);
  } catch {
    throw new ApiError(
      401,
      'AUTH_INVALID_TOKEN',
      'La sesión no es válida o el token expiró.',
    );
  }
}

export function requireAuth(allowedRoles?: readonly UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    void (async () => {
      const decodedToken = await verifyFirebaseToken(req);
      const role = getRoleFromToken(decodedToken);

      const profile = await findUserProfileByFirebaseUid(decodedToken.uid);

      if (!profile || !profile.active) {
        throw new ApiError(
          403,
          'ROLE_FORBIDDEN',
          'El usuario no tiene un perfil activo en XRLAB.',
        );
      }

      if (profile.role !== role) {
        throw new ApiError(
          403,
          'ROLE_FORBIDDEN',
          'El rol de Firebase no coincide con el perfil registrado en XRLAB.',
        );
      }

      if (allowedRoles?.length && !allowedRoles.includes(role)) {
        throw new ApiError(
          403,
          'ROLE_FORBIDDEN',
          'No tiene permisos para acceder a este recurso.',
        );
      }

      if (role === 'ADMIN' || role === 'TEACHER') {
        await updateLastLoginAt(profile.id);
      }

      req.authUser = {
        uid: decodedToken.uid,
        email: decodedToken.email ?? profile.email,
        role,
        profile,
        token: decodedToken,
      };

      next();
    })().catch(next);
  };
}
