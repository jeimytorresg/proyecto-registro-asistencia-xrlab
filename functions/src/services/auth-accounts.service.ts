import type { UserRecord } from 'firebase-admin/auth';
import type { PoolClient } from 'pg';
import { adminAuth } from '../config/firebase-admin.js';
import { ApiError } from '../http/api-error.js';
import type { UserRole } from '../domain/roles.js';

export interface EnsuredAuthAccount {
  uid: string;
  email: string;
  /** true mientras la cuenta no tenga contraseña: la define en su primer ingreso. */
  firstAccessPending: boolean;
}

interface AuthAccountParams {
  profileId: string;
  role: UserRole;
  displayName: string;
}

function isUserNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'auth/user-not-found'
  );
}

/** Los perfiles creados desde el panel nacen con un UID provisional `manual-…`. */
function linkedFirebaseUid(firebaseUid: string): string | null {
  return firebaseUid.startsWith('manual-') ? null : firebaseUid;
}

function hasPassword(user: UserRecord): boolean {
  return user.providerData.some((provider) => provider.providerId === 'password');
}

async function findAuthUser(uid: string | null, email: string): Promise<UserRecord | null> {
  try {
    if (uid) {
      return await adminAuth.getUser(uid);
    }
  } catch (error) {
    if (!isUserNotFound(error)) {
      throw error;
    }
  }

  try {
    return await adminAuth.getUserByEmail(email);
  } catch (error) {
    if (isUserNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/** Pendiente de primer ingreso = aún sin cuenta en Firebase Auth o sin contraseña definida. */
export async function isFirstAccessPending(firebaseUid: string, email: string): Promise<boolean> {
  const user = await findAuthUser(linkedFirebaseUid(firebaseUid), email);

  return !user || !hasPassword(user);
}

/**
 * Garantiza que el perfil tenga una cuenta real en Firebase Auth con el rol en
 * sus custom claims, y guarda su UID en users_profiles. La cuenta se crea sin
 * contraseña: el usuario la define en su primer ingreso.
 */
export async function ensureAuthAccount(
  client: PoolClient,
  params: AuthAccountParams,
): Promise<EnsuredAuthAccount> {
  const profileResult = await client.query<{ firebase_uid: string; email: string; role: UserRole }>(
    `select firebase_uid, email::text as email, role from users_profiles where id = $1;`,
    [params.profileId],
  );
  const profile = profileResult.rows[0];

  if (!profile) {
    throw new ApiError(404, 'NOT_FOUND', 'Perfil de usuario no encontrado.');
  }

  if (profile.role !== params.role) {
    throw new ApiError(409, 'EMAIL_IN_USE', 'El correo ya está registrado en XRLAB con otro rol.');
  }

  let user = await findAuthUser(linkedFirebaseUid(profile.firebase_uid), profile.email);

  if (!user) {
    user = await adminAuth.createUser({ email: profile.email, displayName: params.displayName });
  } else if (user.email?.toLowerCase() !== profile.email.toLowerCase()) {
    user = await adminAuth.updateUser(user.uid, { email: profile.email });
  }

  const currentRole = user.customClaims?.['role'];

  if (currentRole && currentRole !== params.role) {
    throw new ApiError(409, 'EMAIL_IN_USE', 'El correo ya tiene una cuenta con otro rol.');
  }

  if (currentRole !== params.role) {
    await adminAuth.setCustomUserClaims(user.uid, { ...user.customClaims, role: params.role });
  }

  if (user.uid !== profile.firebase_uid) {
    await client.query(
      `update users_profiles set firebase_uid = $2, updated_at = now() where id = $1;`,
      [params.profileId, user.uid],
    );
  }

  return {
    uid: user.uid,
    email: profile.email,
    firstAccessPending: !hasPassword(user),
  };
}

/**
 * Deja la cuenta como pendiente de primer ingreso para que la persona cree una
 * contraseña nueva. Firebase no permite quitar la contraseña de una cuenta, así
 * que se elimina y se vuelve a crear vacía (con otro UID). Eso también invalida
 * las sesiones abiertas: el UID anterior deja de existir en users_profiles.
 */
export async function resetAuthAccount(
  client: PoolClient,
  params: AuthAccountParams,
): Promise<EnsuredAuthAccount> {
  const account = await ensureAuthAccount(client, params);

  if (account.firstAccessPending) {
    return account;
  }

  try {
    await adminAuth.deleteUser(account.uid);
  } catch (error) {
    // Un restablecimiento simultáneo ya la eliminó: se continúa igual.
    if (!isUserNotFound(error)) {
      throw error;
    }
  }

  return ensureAuthAccount(client, params);
}
