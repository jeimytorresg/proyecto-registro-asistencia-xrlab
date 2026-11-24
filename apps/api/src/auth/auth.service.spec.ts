import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { ApiError } from '../common/api-error';
import type { Env } from '../config/env.schema';
import type { AuthTokensRepository } from './auth-tokens.repository';
import { AuthService } from './auth.service';
import type { MailService } from './mail.service';
import { PasswordService } from './password.service';
import { hashOpaqueToken, TokenService } from './token.service';
import type { UsersRepository, UserWithCredentials } from './users.repository';

const CONFIG_VALUES: Record<string, unknown> = {
  JWT_ACCESS_SECRET: 'unit-test-secret-unit-test-secret-0123456789',
  JWT_ACCESS_TTL_S: 900,
  REFRESH_TTL_DAYS: 30,
  AUTH_TOKEN_TTL_HOURS: 48,
  APP_BASE_URL: 'https://app.test/',
};

const config = { get: (key: string) => CONFIG_VALUES[key] } as unknown as ConfigService<Env, true>;

function buildUser(overrides: Partial<UserWithCredentials> = {}): UserWithCredentials {
  return {
    id: 'user-1',
    firebaseUid: 'uid-1',
    email: 'ana@xrlab.test',
    role: 'STUDENT',
    firstName: 'Ana',
    lastName: 'Pérez',
    active: true,
    lastLoginAt: null,
    passwordHash: null,
    ...overrides,
  };
}

describe('AuthService', () => {
  let users: jest.Mocked<Pick<UsersRepository, 'findByEmail' | 'findById' | 'setPasswordHash' | 'touchLastLogin'>>;
  let tokensRepo: jest.Mocked<
    Pick<
      AuthTokensRepository,
      | 'createAuthToken'
      | 'consumeAuthToken'
      | 'createRefreshToken'
      | 'revokeActiveRefreshToken'
      | 'findFamilyByTokenHash'
      | 'revokeFamily'
      | 'revokeAllForUser'
    >
  >;
  let mail: jest.Mocked<Pick<MailService, 'send'>>;
  let passwords: PasswordService;
  let tokenService: TokenService;
  let service: AuthService;
  let storedHash: string;

  beforeAll(async () => {
    passwords = new PasswordService();
    storedHash = await passwords.hash('contraseña-correcta-1');
  });

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      setPasswordHash: jest.fn().mockResolvedValue(undefined),
      touchLastLogin: jest.fn().mockResolvedValue(undefined),
    };
    tokensRepo = {
      createAuthToken: jest.fn().mockResolvedValue(undefined),
      consumeAuthToken: jest.fn(),
      createRefreshToken: jest.fn().mockResolvedValue('family-1'),
      revokeActiveRefreshToken: jest.fn(),
      findFamilyByTokenHash: jest.fn(),
      revokeFamily: jest.fn().mockResolvedValue(undefined),
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
    };
    mail = { send: jest.fn().mockResolvedValue(undefined) };

    const jwt = {
      signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
      verifyAsync: jest.fn(),
    } as unknown as JwtService;
    tokenService = new TokenService(jwt, config);

    service = new AuthService(
      users as unknown as UsersRepository,
      tokensRepo as unknown as AuthTokensRepository,
      passwords,
      tokenService,
      mail as unknown as MailService,
      config,
    );
  });

  describe('login', () => {
    it('devuelve tokens y perfil sin hash cuando las credenciales son correctas', async () => {
      users.findByEmail.mockResolvedValue(buildUser({ passwordHash: storedHash }));

      const session = await service.login('ana@xrlab.test', 'contraseña-correcta-1');

      expect(session.accessToken).toBe('signed.jwt.token');
      expect(session.refreshToken.length).toBeGreaterThan(20);
      expect(session.expiresIn).toBe(900);
      expect(session.user).not.toHaveProperty('passwordHash');
      expect(users.touchLastLogin).toHaveBeenCalledWith('user-1');
    });

    it('guarda solo el hash del refresh token, nunca el valor entregado', async () => {
      users.findByEmail.mockResolvedValue(buildUser({ passwordHash: storedHash }));

      const session = await service.login('ana@xrlab.test', 'contraseña-correcta-1');
      const saved = tokensRepo.createRefreshToken.mock.calls[0]?.[0];

      expect(saved?.tokenHash).toBe(hashOpaqueToken(session.refreshToken));
      expect(saved?.tokenHash).not.toBe(session.refreshToken);
    });

    it.each([
      ['contraseña incorrecta', buildUser({ passwordHash: 'x' }), 'otra-contraseña'],
      ['correo inexistente', null, 'contraseña-correcta-1'],
      ['cuenta inactiva', buildUser({ active: false, passwordHash: 'x' }), 'contraseña-correcta-1'],
      ['cuenta sin contraseña definida', buildUser({ passwordHash: null }), 'contraseña-correcta-1'],
    ])('responde el mismo error genérico con %s', async (_label, user, password) => {
      users.findByEmail.mockResolvedValue(user);

      await expect(service.login('ana@xrlab.test', password)).rejects.toMatchObject({
        code: 'AUTH_INVALID_CREDENTIALS',
      });
      expect(tokensRepo.createRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('rota el token conservando la familia', async () => {
      tokensRepo.revokeActiveRefreshToken.mockResolvedValue({
        id: 'rt-1',
        userProfileId: 'user-1',
        familyId: 'family-1',
      });
      users.findById.mockResolvedValue(buildUser());

      const session = await service.refresh('refresh-token-valido-0123456789');

      expect(tokensRepo.createRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({ userProfileId: 'user-1', familyId: 'family-1' }),
      );
      expect(session.refreshToken).not.toBe('refresh-token-valido-0123456789');
    });

    it('revoca toda la familia si se reutiliza un token ya rotado', async () => {
      tokensRepo.revokeActiveRefreshToken.mockResolvedValue(null);
      tokensRepo.findFamilyByTokenHash.mockResolvedValue('family-1');

      await expect(service.refresh('token-ya-usado-0123456789')).rejects.toMatchObject({
        code: 'AUTH_INVALID_TOKEN',
      });
      expect(tokensRepo.revokeFamily).toHaveBeenCalledWith('family-1');
    });

    it('rechaza un token desconocido sin revocar nada', async () => {
      tokensRepo.revokeActiveRefreshToken.mockResolvedValue(null);
      tokensRepo.findFamilyByTokenHash.mockResolvedValue(null);

      await expect(service.refresh('token-inventado-0123456789')).rejects.toBeInstanceOf(ApiError);
      expect(tokensRepo.revokeFamily).not.toHaveBeenCalled();
    });

    it('cierra la familia si el usuario fue desactivado', async () => {
      tokensRepo.revokeActiveRefreshToken.mockResolvedValue({
        id: 'rt-1',
        userProfileId: 'user-1',
        familyId: 'family-1',
      });
      users.findById.mockResolvedValue(buildUser({ active: false }));

      await expect(service.refresh('refresh-token-valido-0123456789')).rejects.toMatchObject({
        code: 'AUTH_INVALID_TOKEN',
      });
      expect(tokensRepo.revokeFamily).toHaveBeenCalledWith('family-1');
    });
  });

  describe('logout', () => {
    it('revoca la familia del refresh token', async () => {
      tokensRepo.findFamilyByTokenHash.mockResolvedValue('family-1');

      await service.logout('refresh-token-valido-0123456789');

      expect(tokensRepo.revokeFamily).toHaveBeenCalledWith('family-1');
    });

    it('no falla con un token desconocido', async () => {
      tokensRepo.findFamilyByTokenHash.mockResolvedValue(null);

      await expect(service.logout('token-inventado-0123456789')).resolves.toBeUndefined();
    });
  });

  describe('setPassword', () => {
    it('guarda un hash argon2 (no la contraseña) y cierra todas las sesiones', async () => {
      tokensRepo.consumeAuthToken.mockResolvedValue('user-1');
      users.findById.mockResolvedValue(buildUser());

      await service.setPassword('token-de-invitacion-0123456789', 'nueva-contraseña-1');

      const savedHash = users.setPasswordHash.mock.calls[0]?.[1] ?? '';
      expect(savedHash).toMatch(/^\$argon2id\$/);
      expect(savedHash).not.toContain('nueva-contraseña-1');
      expect(tokensRepo.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });

    it('busca el token por su hash', async () => {
      tokensRepo.consumeAuthToken.mockResolvedValue('user-1');
      users.findById.mockResolvedValue(buildUser());

      await service.setPassword('token-de-invitacion-0123456789', 'nueva-contraseña-1');

      expect(tokensRepo.consumeAuthToken).toHaveBeenCalledWith(hashOpaqueToken('token-de-invitacion-0123456789'));
    });

    it('rechaza un token inválido, vencido o ya usado', async () => {
      tokensRepo.consumeAuthToken.mockResolvedValue(null);

      await expect(service.setPassword('token-malo-0123456789012', 'nueva-contraseña-1')).rejects.toMatchObject({
        code: 'AUTH_TOKEN_INVALID',
      });
      expect(users.setPasswordHash).not.toHaveBeenCalled();
    });

    it('rechaza el token si el usuario está inactivo', async () => {
      tokensRepo.consumeAuthToken.mockResolvedValue('user-1');
      users.findById.mockResolvedValue(buildUser({ active: false }));

      await expect(service.setPassword('token-de-invitacion-0123456789', 'nueva-contraseña-1')).rejects.toMatchObject(
        { code: 'AUTH_TOKEN_INVALID' },
      );
      expect(users.setPasswordHash).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('envía un correo con enlace y guarda solo el hash del token', async () => {
      users.findByEmail.mockResolvedValue(buildUser());

      await service.forgotPassword('ana@xrlab.test');

      const sent = mail.send.mock.calls[0]?.[0];
      const savedHash = tokensRepo.createAuthToken.mock.calls[0]?.[0].tokenHash;
      const rawToken = new URL(sent?.text.match(/https:\/\/\S+/)?.[0] ?? '').searchParams.get('token') ?? '';

      expect(sent?.to).toBe('ana@xrlab.test');
      expect(sent?.text).toContain('https://app.test/set-password?token=');
      expect(savedHash).toBe(hashOpaqueToken(rawToken));
      expect(tokensRepo.createAuthToken).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'RESET' }));
    });

    it.each([
      ['no existe', null],
      ['está inactiva', buildUser({ active: false })],
    ])('no envía nada ni falla cuando la cuenta %s', async (_label, user) => {
      users.findByEmail.mockResolvedValue(user);

      await expect(service.forgotPassword('ana@xrlab.test')).resolves.toBeUndefined();
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('no revela fallos del proveedor de correo', async () => {
      users.findByEmail.mockResolvedValue(buildUser());
      mail.send.mockRejectedValue(new Error('Resend caído'));

      await expect(service.forgotPassword('ana@xrlab.test')).resolves.toBeUndefined();
    });
  });

  describe('sendInvitation', () => {
    it('genera un token INVITE para el usuario', async () => {
      users.findById.mockResolvedValue(buildUser());

      await service.sendInvitation('user-1');

      expect(tokensRepo.createAuthToken).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'INVITE' }));
      expect(mail.send).toHaveBeenCalledTimes(1);
    });

    it('lanza NOT_FOUND si el perfil no existe', async () => {
      users.findById.mockResolvedValue(null);

      await expect(service.sendInvitation('nadie')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
