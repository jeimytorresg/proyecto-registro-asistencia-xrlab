import 'dotenv/config';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Uso: node scripts/run-sql.mjs <archivo.sql>');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en database/.env');
  process.exit(1);
}

const absolutePath = path.resolve(filePath);
const sql = await readFile(absolutePath, 'utf8');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

try {
  await client.connect();
  await client.query(sql);
  console.log(`OK: ${filePath}`);
} catch (error) {
  console.error(`ERROR ejecutando ${filePath}`);
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
