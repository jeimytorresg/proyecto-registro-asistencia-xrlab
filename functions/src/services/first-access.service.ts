import { db } from '../config/db.js';
import { adminAuth } from '../config/firebase-admin.js';
import type { UserRole } from '../domain/roles.js';
import { ApiError } from '../http/api-error.js';
import { insertAudit } from './audit-log.service.js';
import { ensureAuthAccount, isFirstAccessPending } from './auth-accounts.service.js';

/** FIRST_ACCESS: debe crear su contraseña. PASSWORD: inicia sesión con su contraseña. */
export type AccessStatus = 'FIRST_ACCESS' | 'PASSWORD';

interface AccessProfileRow {
  id: string;
  firebase_uid: string;
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  active: boolean;
}

/**
 * "Desactivar" en el panel solo marca students/teachers, así que la cuenta se
 * considera activa únicamente si el perfil y su registro asociado lo están.
 */
const ACCESS_PROFILE_QUERY = `
  select
    profile.id,
    profile.firebase_uid,
    profile.email::text as email,
    profile.role,
    profile.first_name,
    profile.last_name,
    (profile.active and coalesce(student.active, true) and coalesce(teacher.active, true)) as active
  from users_profiles profile
  left join students student on student.user_profile_id = profile.id
  left join teachers teacher on teacher.user_profile_id = profile.id
  where profile.email = $1
  limit 1
`;

/**
 * Perfiles de `database:seed:users`: solo tienen contraseña en el Auth Emulator.
 * Si la base se comparte con producción no deben poder activarse ahí.
 */
const DEV_SEED_UID_PREFIX = 'dev-';

/** Códigos con los que Firebase rechaza una contraseña por su política de seguridad. */
const FIREBASE_WEAK_PASSWORD_CODES = new Set([
  'auth/invalid-password',
  'auth/password-does-not-meet-requirements',
]);

function firstAccessUnavailable(): ApiError {
  return new ApiError(
    409,
    'FIRST_ACCESS_UNAVAILABLE',
    'Esta cuenta no está habilitada para primer ingreso. Inicie sesión con su contraseña o contacte al administrador.',
  );
}

function isEligibleForFirstAccess(profile: AccessProfileRow | undefined): profile is AccessProfileRow {
  return !!profile && profile.active && !profile.firebase_uid.startsWith(DEV_SEED_UID_PREFIX);
}

function isWeakPasswordError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : null;

  return typeof code === 'string' && FIREBASE_WEAK_PASSWORD_CODES.has(code);
}

/**
 * Indica si el correo debe crear su contraseña o iniciar sesión normalmente.
 * Los correos desconocidos o desactivados responden PASSWORD para no revelar
 * cuáles existen: el inicio de sesión fallará luego con el mensaje genérico.
 */
export async function getAccessStatus(email: string): Promise<AccessStatus> {
  const result = await db.query<AccessProfileRow>(`${ACCESS_PROFILE_QUERY};`, [email]);
  const profile = result.rows[0];

  if (!isEligibleForFirstAccess(profile)) {
    return 'PASSWORD';
  }

  const pending = await isFirstAccessPending(profile.firebase_uid, profile.email);

  return pending ? 'FIRST_ACCESS' : 'PASSWORD';
}

/**
 * Primer ingreso: guarda la contraseña de una cuenta registrada por el admin que
 * aún no la tiene. Si la cuenta ya tiene contraseña, se rechaza.
 */
export async function completeFirstAccess(params: {
  email: string;
  password: string;
  requestId: string;
}): Promise<{ email: string }> {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // `for update` serializa dos primeros ingresos simultáneos del mismo correo.
    const result = await client.query<AccessProfileRow>(
      `${ACCESS_PROFILE_QUERY} for update of profile;`,
      [params.email],
    );
    const profile = result.rows[0];

    if (!isEligibleForFirstAccess(profile)) {
      throw firstAccessUnavailable();
    }

    const account = await ensureAuthAccount(client, {
      profileId: profile.id,
      role: profile.role,
      displayName: `${profile.first_name} ${profile.last_name}`,
    });

    if (!account.firstAccessPending) {
      throw firstAccessUnavailable();
    }

    await insertAudit(client, {
      actorUserId: profile.id,
      actorRole: profile.role,
      action: 'FIRST_ACCESS_COMPLETED',
      entityType: 'users_profiles',
      entityId: profile.id,
      newData: { email: account.email },
      source: 'API',
      requestId: params.requestId,
    });

    // Último paso antes del COMMIT: Firebase no participa de la transacción, así
    // que la contraseña se guarda cuando todo lo demás ya se escribió.
    try {
      await adminAuth.updateUser(account.uid, { password: params.password });
    } catch (error) {
      if (isWeakPasswordError(error)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'La contraseña no cumple la política de seguridad.');
      }
      throw error;
    }

    await client.query('COMMIT');

    return { email: account.email };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
