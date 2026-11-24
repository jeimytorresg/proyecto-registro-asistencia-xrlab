import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { PG_POOL } from './database.constants';

/**
 * Mensajes de pg cuando la conexión NO llegó a establecerse a tiempo (típico al despertar Neon).
 * Son los únicos casos en los que es seguro reintentar: la consulta nunca llegó a ejecutarse.
 * "Connection terminated unexpectedly" se excluye a propósito: puede ocurrir a mitad de una consulta
 * y reintentar una escritura podría duplicarla.
 */
const CONNECT_TIMEOUT_MESSAGES: readonly string[] = [
  'timeout exceeded when trying to connect',
  'Connection terminated due to connection timeout',
];

function isConnectTimeout(error: unknown): boolean {
  return error instanceof Error && CONNECT_TIMEOUT_MESSAGES.some((message) => error.message.includes(message));
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Ejecuta una consulta parametrizada. Reintenta una sola vez si la conexión no se pudo establecer. */
  async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<R>> {
    try {
      return await this.pool.query<R>(text, params);
    } catch (error) {
      if (!isConnectTimeout(error)) {
        throw error;
      }

      this.logger.warn('No se pudo conectar a la base de datos a tiempo; reintentando una vez.');

      return this.pool.query<R>(text, params);
    }
  }

  /** Ejecuta `work` dentro de una transacción: COMMIT si termina bien, ROLLBACK si lanza. */
  async withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    let discardReason: Error | undefined;

    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');

      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // El error original es el importante; la conexión se descarta en lugar de reutilizarla.
        discardReason =
          rollbackError instanceof Error ? rollbackError : new Error('Falló el ROLLBACK de la transacción.');
        this.logger.warn(`Falló el ROLLBACK: ${discardReason.message}`);
      }

      throw error;
    } finally {
      client.release(discardReason);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
