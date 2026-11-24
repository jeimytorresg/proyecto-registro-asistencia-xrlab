import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env.schema';
import { isUserRole, type UserRole } from '../common/roles';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export interface OpaqueToken {
  /** Valor que se entrega al cliente (o se envía por correo). Nunca se guarda. */
  token: string;
  /** sha256 en hex: lo único que se guarda en la BD. */
  hash: string;
}

const OPAQUE_TOKEN_BYTES = 32;

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get accessTtlSeconds(): number {
    return this.config.get('JWT_ACCESS_TTL_S', { infer: true });
  }

  signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(
      { role: payload.role },
      { subject: payload.sub, expiresIn: this.accessTtlSeconds },
    );
  }

  /** Devuelve el payload o `null` si el token es inválido, está vencido o no trae un rol válido. */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
    try {
      const decoded = await this.jwt.verifyAsync<{ sub?: unknown; role?: unknown }>(token);

      if (typeof decoded.sub !== 'string' || !isUserRole(decoded.role)) {
        return null;
      }

      return { sub: decoded.sub, role: decoded.role };
    } catch {
      return null;
    }
  }

  generateOpaqueToken(): OpaqueToken {
    const token = randomBytes(OPAQUE_TOKEN_BYTES).toString('base64url');

    return { token, hash: hashOpaqueToken(token) };
  }
}
