import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import type { Env } from '../config/env.schema';
import { PG_POOL } from './database.constants';
import { DatabaseService } from './database.service';

// Neon suspende el cómputo tras 5 min sin actividad: timeouts holgados para tolerar el despertar,
// y conexiones ociosas cortas para no mantener sockets muertos.
const CONNECTION_TIMEOUT_MS = 10_000;
const IDLE_TIMEOUT_MS = 10_000;

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Pool => {
        const pool = new Pool({
          connectionString: config.get('DATABASE_URL', { infer: true }),
          max: config.get('PG_POOL_MAX', { infer: true }),
          idleTimeoutMillis: IDLE_TIMEOUT_MS,
          connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
          keepAlive: true,
        });

        // Sin este handler, un error en un cliente ocioso (p. ej. Neon cierra la conexión) tumba el proceso.
        pool.on('error', (error) => {
          new Logger('PgPool').error(`Error en un cliente ocioso del pool: ${error.message}`);
        });

        return pool;
      },
    },
    DatabaseService,
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
