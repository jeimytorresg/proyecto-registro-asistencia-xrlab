import { db } from '../config/db.js';
import type { UserRole } from '../domain/roles.js';

export interface UserProfile {
  id: string;
  firebaseUid: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  active: boolean;
  lastLoginAt: string | null;
}

interface UserProfileRow {
  id: string;
  firebase_uid: string;
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  active: boolean;
  last_login_at: Date | null;
}

function mapUserProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    firebaseUid: row.firebase_uid,
    email: row.email,
    role: row.role,
    firstName: row.first_name,
    lastName: row.last_name,
    active: row.active,
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
  };
}

export async function findUserProfileByFirebaseUid(
  firebaseUid: string,
): Promise<UserProfile | null> {
  const result = await db.query<UserProfileRow>(
    `
      select
        id,
        firebase_uid,
        email::text as email,
        role,
        first_name,
        last_name,
        active,
        last_login_at
      from users_profiles
      where firebase_uid = $1
      limit 1;
    `,
    [firebaseUid],
  );

  const row = result.rows[0];

  return row ? mapUserProfile(row) : null;
}

export async function updateLastLoginAt(userProfileId: string): Promise<void> {
  await db.query(
    `
      update users_profiles
      set last_login_at = now()
      where id = $1;
    `,
    [userProfileId],
  );
}
