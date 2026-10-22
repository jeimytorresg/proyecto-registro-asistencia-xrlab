import type { PoolClient } from 'pg';
import { db } from '../config/db.js';
import type { UserRole } from '../domain/roles.js';
import type { QrBatch } from '../domain/qr-token.js';
import { ApiError } from '../http/api-error.js';
import { generateQrBatch } from './qr-token.service.js';

export interface KioskInfo {
  id: string;
  code: string;
  name: string;
  location: string;
  active: boolean;
}

export interface KioskSessionInfo {
  id: string;
  status: 'ACTIVE' | 'CLOSED' | 'EXPIRED';
  openedAt: string;
  closedAt: string | null;
  kiosk: KioskInfo;
}

interface KioskRow {
  id: string;
  code: string;
  name: string;
  location: string;
  active: boolean;
}

interface KioskSessionRow {
  id: string;
  status: 'ACTIVE' | 'CLOSED' | 'EXPIRED';
  opened_at: Date;
  closed_at: Date | null;
  kiosk_id: string;
  code: string;
  name: string;
  location: string;
  kiosk_active: boolean;
}

function mapSession(row: KioskSessionRow): KioskSessionInfo {
  return {
    id: row.id,
    status: row.status,
    openedAt: row.opened_at.toISOString(),
    closedAt: row.closed_at?.toISOString() ?? null,
    kiosk: {
      id: row.kiosk_id,
      code: row.code,
      name: row.name,
      location: row.location,
      active: row.kiosk_active,
    },
  };
}

async function insertAuditLog(
  client: PoolClient,
  params: {
    actorUserProfileId: string;
    actorRole: UserRole;
    action: string;
    entityType: string;
    entityId: string;
    newData: unknown;
    requestId: string;
  },
): Promise<void> {
  await client.query(
    `
      insert into audit_logs (
        actor_user_id,
        actor_role,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data,
        source,
        request_id
      )
      values ($1, $2, $3, $4, $5, null, $6::jsonb, 'API', $7);
    `,
    [
      params.actorUserProfileId,
      params.actorRole,
      params.action,
      params.entityType,
      params.entityId,
      JSON.stringify(params.newData),
      params.requestId,
    ],
  );
}

async function getKioskByCodeForUpdate(
  client: PoolClient,
  kioskCode: string,
): Promise<KioskRow> {
  const result = await client.query<KioskRow>(
    `
      select id, code, name, location, active
      from kiosks
      where code = $1
      for update;
    `,
    [kioskCode],
  );

  const kiosk = result.rows[0];

  if (!kiosk) {
    throw new ApiError(404, 'KIOSK_NOT_FOUND', 'El kiosko solicitado no existe.');
  }

  if (!kiosk.active) {
    throw new ApiError(403, 'KIOSK_INACTIVE', 'El kiosko está desactivado.');
  }

  return kiosk;
}

async function getActiveSessionByKioskId(
  client: PoolClient,
  kioskId: string,
): Promise<KioskSessionInfo | null> {
  const result = await client.query<KioskSessionRow>(
    `
      select
        session.id,
        session.status,
        session.opened_at,
        session.closed_at,
        kiosk.id as kiosk_id,
        kiosk.code,
        kiosk.name,
        kiosk.location,
        kiosk.active as kiosk_active
      from kiosk_sessions session
      join kiosks kiosk on kiosk.id = session.kiosk_id
      where session.kiosk_id = $1
        and session.status = 'ACTIVE'
      order by session.opened_at desc
      limit 1;
    `,
    [kioskId],
  );

  const row = result.rows[0];

  return row ? mapSession(row) : null;
}

export async function openKioskSession(params: {
  kioskCode: string;
  actorUserProfileId: string;
  actorRole: UserRole;
  requestId: string;
}): Promise<{ session: KioskSessionInfo; reused: boolean }> {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const kiosk = await getKioskByCodeForUpdate(client, params.kioskCode);

    const existingSession = await getActiveSessionByKioskId(client, kiosk.id);

    await client.query(
      `
        update kiosks
        set last_seen_at = now()
        where id = $1;
      `,
      [kiosk.id],
    );

    if (existingSession) {
      await insertAuditLog(client, {
        actorUserProfileId: params.actorUserProfileId,
        actorRole: params.actorRole,
        action: 'KIOSK_SESSION_REUSED',
        entityType: 'kiosk_sessions',
        entityId: existingSession.id,
        newData: existingSession,
        requestId: params.requestId,
      });

      await client.query('COMMIT');

      return {
        session: existingSession,
        reused: true,
      };
    }

    const inserted = await client.query<KioskSessionRow>(
      `
        insert into kiosk_sessions (
          kiosk_id,
          opened_by_user_id,
          opened_at,
          status
        )
        values ($1, $2, now(), 'ACTIVE')
        returning
          id,
          status,
          opened_at,
          closed_at,
          kiosk_id,
          $3::text as code,
          $4::text as name,
          $5::text as location,
          true as kiosk_active;
      `,
      [kiosk.id, params.actorUserProfileId, kiosk.code, kiosk.name, kiosk.location],
    );

    const session = mapSession(inserted.rows[0]);

    await insertAuditLog(client, {
      actorUserProfileId: params.actorUserProfileId,
      actorRole: params.actorRole,
      action: 'KIOSK_SESSION_OPENED',
      entityType: 'kiosk_sessions',
      entityId: session.id,
      newData: session,
      requestId: params.requestId,
    });

    await client.query('COMMIT');

    return {
      session,
      reused: false,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function closeKioskSession(params: {
  kioskSessionId: string;
  actorUserProfileId: string;
  actorRole: UserRole;
  requestId: string;
}): Promise<{ session: KioskSessionInfo }> {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const current = await client.query<KioskSessionRow>(
      `
        select
          session.id,
          session.status,
          session.opened_at,
          session.closed_at,
          kiosk.id as kiosk_id,
          kiosk.code,
          kiosk.name,
          kiosk.location,
          kiosk.active as kiosk_active
        from kiosk_sessions session
        join kiosks kiosk on kiosk.id = session.kiosk_id
        where session.id = $1
        for update;
      `,
      [params.kioskSessionId],
    );

    const row = current.rows[0];

    if (!row) {
      throw new ApiError(404, 'KIOSK_SESSION_NOT_FOUND', 'La sesión de kiosko no existe.');
    }

    let session = mapSession(row);

    if (row.status === 'ACTIVE') {
      const updated = await client.query<KioskSessionRow>(
        `
          update kiosk_sessions
          set
            status = 'CLOSED',
            closed_at = now()
          where id = $1
          returning
            id,
            status,
            opened_at,
            closed_at,
            kiosk_id,
            $2::text as code,
            $3::text as name,
            $4::text as location,
            $5::boolean as kiosk_active;
        `,
        [row.id, row.code, row.name, row.location, row.kiosk_active],
      );

      session = mapSession(updated.rows[0]);
    }

    await insertAuditLog(client, {
      actorUserProfileId: params.actorUserProfileId,
      actorRole: params.actorRole,
      action: 'KIOSK_SESSION_CLOSED',
      entityType: 'kiosk_sessions',
      entityId: session.id,
      newData: session,
      requestId: params.requestId,
    });

    await client.query('COMMIT');

    return { session };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createQrBatchForKioskSession(params: {
  kioskSessionId: string;
  requestedBatchSeconds?: number;
}): Promise<QrBatch> {
  const result = await db.query<KioskSessionRow>(
    `
      select
        session.id,
        session.status,
        session.opened_at,
        session.closed_at,
        kiosk.id as kiosk_id,
        kiosk.code,
        kiosk.name,
        kiosk.location,
        kiosk.active as kiosk_active
      from kiosk_sessions session
      join kiosks kiosk on kiosk.id = session.kiosk_id
      where session.id = $1
      limit 1;
    `,
    [params.kioskSessionId],
  );

  const row = result.rows[0];

  if (!row) {
    throw new ApiError(404, 'KIOSK_SESSION_NOT_FOUND', 'La sesión de kiosko no existe.');
  }

  if (!row.kiosk_active) {
    throw new ApiError(403, 'KIOSK_INACTIVE', 'El kiosko está desactivado.');
  }

  if (row.status !== 'ACTIVE') {
    throw new ApiError(400, 'KIOSK_SESSION_INACTIVE', 'La sesión de kiosko no está activa.');
  }

  await db.query(
    `
      update kiosks
      set last_seen_at = now()
      where id = $1;
    `,
    [row.kiosk_id],
  );

  return generateQrBatch({
    kioskCode: row.code,
    kioskSessionId: row.id,
    requestedBatchSeconds: params.requestedBatchSeconds,
  });
}
