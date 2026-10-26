import type { UserRecord } from 'firebase-admin/auth';
import type { PoolClient } from 'pg';
import { adminAuth } from '../config/firebase-admin.js';
import { ApiError } from '../http/api-error.js';
import type { UserRole } from '../domain/roles.js';

export interface EnsuredAuthAccount {
  uid: string;
  email: string;
  invitationPending: boolean;
}

function isUserNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'auth/user-not-found'
  );
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

/**
 * Garantiza que el perfil tenga una cuenta real en Firebase Auth con el rol en
 * sus custom claims, y guarda su UID en users_profiles. La cuenta se crea sin
 * contraseña: el usuario la define desde el correo de invitación.
 */
export async function ensureAuthAccount(
  client: PoolClient,
  params: { profileId: string; role: UserRole; displayName: string },
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

  const linkedUid = profile.firebase_uid.startsWith('manual-') ? null : profile.firebase_uid;
  let user = await findAuthUser(linkedUid, profile.email);

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
    invitationPending: !user.providerData.some((provider) => provider.providerId === 'password'),
  };
}
