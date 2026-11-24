import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard, ROLES_KEY } from './jwt-auth.guard';
import type { TokenService } from './token.service';
import type { UsersRepository, UserWithCredentials } from './users.repository';

function buildUser(overrides: Partial<UserWithCredentials> = {}): UserWithCredentials {
  return {
    id: 'user-1',
    firebaseUid: 'uid-1',
    email: 'ana@xrlab.test',
    role: 'ADMIN',
    firstName: 'Ana',
    lastName: 'Pérez',
    active: true,
    lastLoginAt: null,
    passwordHash: 'secret-hash',
    ...overrides,
  };
}

function buildContext(authorization: string | undefined, roles?: string[]): {
  context: ExecutionContext;
  request: { header: (name: string) => string | undefined; authUser?: unknown };
} {
  const request: { header: (name: string) => string | undefined; authUser?: unknown } = {
    header: (name: string) => (name === 'Authorization' ? authorization : undefined),
  };
  const handler = (): void => undefined;

  if (roles) {
    Reflect.defineMetadata(ROLES_KEY, roles, handler);
  }

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;

  return { context, request };
}

describe('JwtAuthGuard', () => {
  let tokens: jest.Mocked<Pick<TokenService, 'verifyAccessToken'>>;
  let users: jest.Mocked<Pick<UsersRepository, 'findById'>>;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    tokens = { verifyAccessToken: jest.fn() };
    users = { findById: jest.fn() };
    guard = new JwtAuthGuard(tokens as unknown as TokenService, users as unknown as UsersRepository, new Reflector());
  });

  it.each([
    ['sin header Authorization', undefined],
    ['con un esquema distinto de Bearer', 'Basic abc'],
    ['con un Bearer vacío', 'Bearer '],
  ])('responde 401 AUTH_REQUIRED %s', async (_label, header) => {
    const { context } = buildContext(header);

    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('responde 401 AUTH_INVALID_TOKEN si el JWT no es válido', async () => {
    tokens.verifyAccessToken.mockResolvedValue(null);
    const { context } = buildContext('Bearer malo');

    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'AUTH_INVALID_TOKEN' });
  });

  it('deja pasar y adjunta el usuario, sin exponer el hash de contraseña', async () => {
    tokens.verifyAccessToken.mockResolvedValue({ sub: 'user-1', role: 'ADMIN' });
    users.findById.mockResolvedValue(buildUser());
    const { context, request } = buildContext('Bearer bueno');

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(request.authUser).toMatchObject({ id: 'user-1', role: 'ADMIN' });
    expect(JSON.stringify(request.authUser)).not.toContain('secret-hash');
  });

  it('bloquea a un usuario desactivado aunque su token siga vigente', async () => {
    tokens.verifyAccessToken.mockResolvedValue({ sub: 'user-1', role: 'ADMIN' });
    users.findById.mockResolvedValue(buildUser({ active: false }));
    const { context } = buildContext('Bearer bueno');

    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'ROLE_FORBIDDEN' });
  });

  it('bloquea si el rol del token ya no coincide con el del perfil', async () => {
    tokens.verifyAccessToken.mockResolvedValue({ sub: 'user-1', role: 'ADMIN' });
    users.findById.mockResolvedValue(buildUser({ role: 'STUDENT' }));
    const { context } = buildContext('Bearer bueno');

    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'ROLE_FORBIDDEN' });
  });

  it('bloquea a un rol no permitido en la ruta', async () => {
    tokens.verifyAccessToken.mockResolvedValue({ sub: 'user-1', role: 'STUDENT' });
    users.findById.mockResolvedValue(buildUser({ role: 'STUDENT' }));
    const { context } = buildContext('Bearer bueno', ['ADMIN', 'TEACHER']);

    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'ROLE_FORBIDDEN' });
  });

  it('permite un rol incluido en la ruta', async () => {
    tokens.verifyAccessToken.mockResolvedValue({ sub: 'user-1', role: 'TEACHER' });
    users.findById.mockResolvedValue(buildUser({ role: 'TEACHER' }));
    const { context } = buildContext('Bearer bueno', ['ADMIN', 'TEACHER']);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
