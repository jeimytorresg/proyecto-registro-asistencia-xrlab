import pg from 'pg';

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!poolInstance) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL no está configurado para Functions.');
    }

    poolInstance = new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX ?? '2'),
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
    });
  }

  return poolInstance;
}

export const db = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    const pool = getPool();
    const value = pool[prop as keyof pg.Pool];

    return typeof value === 'function' ? value.bind(pool) : value;
  },
});
