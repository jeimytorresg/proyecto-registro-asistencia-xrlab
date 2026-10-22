import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no está configurado para Functions.');
}

export const db = new Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX ?? '2'),
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 5000,
});
