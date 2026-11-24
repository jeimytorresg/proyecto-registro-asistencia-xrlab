import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type AuthTokenPurpose = 'INVITE' | 'RESET';

export interface RefreshTokenRecord {
  id: string;
  userProfileId: string;
  familyId: string;
}

@Injectable()
export class AuthTokensRepository {
  constructor(private readonly db: DatabaseService) {}

  /** Crea un token de invitación/reset e invalida los anteriores sin usar del mismo propósito. */
  async createAuthToken(params: {
    userProfileId: string;
    purpose: AuthTokenPurpose;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.db.withTransaction(async (client) => {
      await client.query(
        `update auth_tokens set used_at = now()
         where user_profile_id = $1 and purpose = $2 and used_at is null;`,
        [params.userProfileId, params.purpose],
      );
      await client.query(
        `insert into auth_tokens (user_profile_id, purpose, token_hash, expires_at)
         values ($1, $2, $3, $4);`,
        [params.userProfileId, params.purpose, params.tokenHash, params.expiresAt],
      );
    });
  }

  /** Marca el token como usado de forma atómica. Devuelve el usuario dueño o `null` si no es válido. */
  async consumeAuthToken(tokenHash: string): Promise<string | null> {
    const result = await this.db.query<{ user_profile_id: string }>(
      `update auth_tokens set used_at = now()
       where token_hash = $1 and used_at is null and expires_at > now()
       returning user_profile_id;`,
      [tokenHash],
    );

    return result.rows[0]?.user_profile_id ?? null;
  }

  /** Guarda un refresh token. Sin `familyId` abre una familia nueva; devuelve el `family_id`. */
  async createRefreshToken(params: {
    userProfileId: string;
    familyId?: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<string> {
    const result = await this.db.query<{ family_id: string }>(
      `insert into refresh_tokens (user_profile_id, family_id, token_hash, expires_at)
       values ($1, coalesce($2::uuid, gen_random_uuid()), $3, $4)
       returning family_id;`,
      [params.userProfileId, params.familyId ?? null, params.tokenHash, params.expiresAt],
    );

    return result.rows[0]?.family_id ?? '';
  }

  /** Revoca el refresh token de forma atómica. Solo tiene éxito si seguía vigente y sin revocar. */
  async revokeActiveRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const result = await this.db.query<{ id: string; user_profile_id: string; family_id: string }>(
      `update refresh_tokens set revoked_at = now()
       where token_hash = $1 and revoked_at is null and expires_at > now()
       returning id, user_profile_id, family_id;`,
      [tokenHash],
    );
    const row = result.rows[0];

    return row ? { id: row.id, userProfileId: row.user_profile_id, familyId: row.family_id } : null;
  }

  /** Familia de un refresh token ya conocido (revocado o vencido). Sirve para detectar reutilización. */
  async findFamilyByTokenHash(tokenHash: string): Promise<string | null> {
    const result = await this.db.query<{ family_id: string }>(
      `select family_id from refresh_tokens where token_hash = $1 limit 1;`,
      [tokenHash],
    );

    return result.rows[0]?.family_id ?? null;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.db.query(
      `update refresh_tokens set revoked_at = now() where family_id = $1 and revoked_at is null;`,
      [familyId],
    );
  }

  async revokeAllForUser(userProfileId: string): Promise<void> {
    await this.db.query(
      `update refresh_tokens set revoked_at = now() where user_profile_id = $1 and revoked_at is null;`,
      [userProfileId],
    );
  }
}
