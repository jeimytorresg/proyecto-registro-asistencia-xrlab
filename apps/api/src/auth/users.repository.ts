import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { UserRole } from '../common/roles';

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

export interface UserWithCredentials extends UserProfile {
  passwordHash: string | null;
}

interface UserRow {
  id: string;
  firebase_uid: string;
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  active: boolean;
  last_login_at: Date | null;
  password_hash: string | null;
}

const USER_COLUMNS = `
  id, firebase_uid, email::text as email, role, first_name, last_name, active, last_login_at, password_hash
`;

function toUser(row: UserRow): UserWithCredentials {
  return {
    id: row.id,
    firebaseUid: row.firebase_uid,
    email: row.email,
    role: row.role,
    firstName: row.first_name,
    lastName: row.last_name,
    active: row.active,
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
    passwordHash: row.password_hash,
  };
}

/** Quita el hash antes de exponer el usuario fuera del módulo de auth. */
export function toPublicProfile(user: UserWithCredentials): UserProfile {
  const { passwordHash: _passwordHash, ...profile } = user;

  return profile;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly db: DatabaseService) {}

  async findByEmail(email: string): Promise<UserWithCredentials | null> {
    const result = await this.db.query<UserRow>(
      `select ${USER_COLUMNS} from users_profiles where email = $1 limit 1;`,
      [email],
    );

    return result.rows[0] ? toUser(result.rows[0]) : null;
  }

  async findById(id: string): Promise<UserWithCredentials | null> {
    const result = await this.db.query<UserRow>(
      `select ${USER_COLUMNS} from users_profiles where id = $1 limit 1;`,
      [id],
    );

    return result.rows[0] ? toUser(result.rows[0]) : null;
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.db.query(
      `update users_profiles set password_hash = $2, updated_at = now() where id = $1;`,
      [id, passwordHash],
    );
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.db.query(`update users_profiles set last_login_at = now() where id = $1;`, [id]);
  }
}
