import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiError } from '../common/api-error';
import type { Env } from '../config/env.schema';
import { AuthTokensRepository, type AuthTokenPurpose } from './auth-tokens.repository';
import { MailService } from './mail.service';
import { PasswordService } from './password.service';
import { hashOpaqueToken, TokenService } from './token.service';
import { toPublicProfile, UsersRepository, type UserProfile, type UserWithCredentials } from './users.repository';

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserProfile;
}

const INVALID_CREDENTIALS = (): ApiError =>
  new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');

const INVALID_REFRESH = (): ApiError =>
  new ApiError(401, 'AUTH_INVALID_TOKEN', 'La sesión no es válida o expiró. Inicie sesión de nuevo.');

const INVALID_LINK = (): ApiError =>
  new ApiError(400, 'AUTH_TOKEN_INVALID', 'El enlace no es válido o ya expiró. Solicite uno nuevo.');

const MAIL_COPY: Record<AuthTokenPurpose, { subject: string; intro: string; path: string }> = {
  INVITE: {
    subject: 'Bienvenido a XRLAB: defina su contraseña',
    intro: 'Se creó una cuenta para usted en XRLAB. Defina su contraseña con este enlace:',
    path: '/set-password',
  },
  RESET: {
    subject: 'XRLAB: restablecer contraseña',
    intro: 'Recibimos una solicitud para restablecer su contraseña. Use este enlace:',
    path: '/set-password',
  },
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly tokensRepo: AuthTokensRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login(email: string, password: string): Promise<SessionTokens> {
    const user = await this.users.findByEmail(email);

    // Mismo error y mismo costo de CPU para correo inexistente, cuenta inactiva, sin contraseña o contraseña errónea.
    const valid =
      user?.active && user.passwordHash
        ? await this.passwords.verify(user.passwordHash, password)
        : await this.passwords.verifyDummy(password);

    if (!user || !valid) {
      throw INVALID_CREDENTIALS();
    }

    await this.users.touchLastLogin(user.id);

    return this.issueSession(user);
  }

  /** Rota el refresh token. Si llega uno ya rotado se asume robo y se revoca toda su familia. */
  async refresh(refreshToken: string): Promise<SessionTokens> {
    const tokenHash = hashOpaqueToken(refreshToken);
    const revoked = await this.tokensRepo.revokeActiveRefreshToken(tokenHash);

    if (!revoked) {
      const familyId = await this.tokensRepo.findFamilyByTokenHash(tokenHash);

      if (familyId) {
        await this.tokensRepo.revokeFamily(familyId);
        this.logger.warn('Se reutilizó un refresh token ya rotado; se revocó su familia.');
      }

      throw INVALID_REFRESH();
    }

    const user = await this.users.findById(revoked.userProfileId);

    if (!user?.active) {
      await this.tokensRepo.revokeFamily(revoked.familyId);
      throw INVALID_REFRESH();
    }

    return this.issueSession(user, revoked.familyId);
  }

  async logout(refreshToken: string): Promise<void> {
    const familyId = await this.tokensRepo.findFamilyByTokenHash(hashOpaqueToken(refreshToken));

    if (familyId) {
      await this.tokensRepo.revokeFamily(familyId);
    }
  }

  /** Define la contraseña a partir de un token de invitación o reset (un solo uso) y cierra todas las sesiones. */
  async setPassword(token: string, password: string): Promise<void> {
    const userId = await this.tokensRepo.consumeAuthToken(hashOpaqueToken(token));

    if (!userId) {
      throw INVALID_LINK();
    }

    const user = await this.users.findById(userId);

    if (!user?.active) {
      throw INVALID_LINK();
    }

    await this.users.setPasswordHash(userId, await this.passwords.hash(password));
    await this.tokensRepo.revokeAllForUser(userId);
  }

  /** Siempre termina sin error, exista o no la cuenta, para no revelar qué correos están registrados. */
  async forgotPassword(email: string): Promise<void> {
    try {
      const user = await this.users.findByEmail(email);

      if (user?.active) {
        await this.sendAuthLink(user, 'RESET');
      }
    } catch (error) {
      this.logger.error(`No se pudo procesar el restablecimiento: ${describeError(error)}`);
    }
  }

  /** Genera el token de invitación y envía el correo. Lo usará el módulo admin al crear usuarios. */
  async sendInvitation(userProfileId: string): Promise<void> {
    const user = await this.users.findById(userProfileId);

    if (!user) {
      throw new ApiError(404, 'NOT_FOUND', 'Perfil de usuario no encontrado.');
    }

    await this.sendAuthLink(user, 'INVITE');
  }

  private async sendAuthLink(user: UserWithCredentials, purpose: AuthTokenPurpose): Promise<void> {
    const { token, hash } = this.tokens.generateOpaqueToken();
    const ttlHours = this.config.get('AUTH_TOKEN_TTL_HOURS', { infer: true });

    await this.tokensRepo.createAuthToken({
      userProfileId: user.id,
      purpose,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + ttlHours * MS_PER_HOUR),
    });

    const copy = MAIL_COPY[purpose];
    const baseUrl = this.config.get('APP_BASE_URL', { infer: true }).replace(/\/+$/, '');
    const link = `${baseUrl}${copy.path}?token=${encodeURIComponent(token)}`;

    await this.mail.send({
      to: user.email,
      subject: copy.subject,
      text: `Hola ${user.firstName},\n\n${copy.intro}\n${link}\n\nEl enlace vence en ${ttlHours} horas y solo puede usarse una vez.`,
    });
  }

  private async issueSession(user: UserWithCredentials, familyId?: string): Promise<SessionTokens> {
    const refresh = this.tokens.generateOpaqueToken();
    const refreshDays = this.config.get('REFRESH_TTL_DAYS', { infer: true });

    await this.tokensRepo.createRefreshToken({
      userProfileId: user.id,
      familyId,
      tokenHash: refresh.hash,
      expiresAt: new Date(Date.now() + refreshDays * MS_PER_DAY),
    });

    return {
      accessToken: await this.tokens.signAccessToken({ sub: user.id, role: user.role }),
      refreshToken: refresh.token,
      expiresIn: this.tokens.accessTtlSeconds,
      user: toPublicProfile(user),
    };
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'error desconocido';
}
