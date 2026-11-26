import type { PoolClient } from 'pg';
import type { UserRole } from '../domain/roles.js';

export interface AuditLogEntry {
  /** null cuando la acción no la ejecuta un usuario (p. ej. un seeder). */
  actorUserId: string | null;
  actorRole: UserRole | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldData?: unknown;
  newData?: unknown;
  source: string;
  reason?: string | null;
  requestId: string;
}

/** Inserta un registro de auditoría dentro de la transacción del cliente recibido. */
export async function insertAudit(client: PoolClient, entry: AuditLogEntry): Promise<void> {
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
        reason,
        request_id
      )
      values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10);
    `,
    [
      entry.actorUserId,
      entry.actorRole,
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.oldData ? JSON.stringify(entry.oldData) : null,
      entry.newData ? JSON.stringify(entry.newData) : null,
      entry.source,
      entry.reason ?? null,
      entry.requestId,
    ],
  );
}
