import { mkdir } from 'node:fs/promises';
import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { config } from '../config.js';
import * as schema from './schema.js';
import { applyMigrations } from './migrate.js';

export type Db = LibSQLDatabase<typeof schema>;

let client: Client | undefined;
let db: Db | undefined;

export async function initDb(): Promise<Db> {
  if (db) return db;

  await mkdir(config.dataDir, { recursive: true });
  await mkdir(config.uploadsDir, { recursive: true });

  client = createClient({ url: config.databaseUrl });

  // WAL keeps a range request reading the stream table from blocking a write,
  // and foreign keys are off by default in SQLite — the cascade deletes in the
  // schema are decorative without this.
  await client.execute('PRAGMA journal_mode = WAL');
  await client.execute('PRAGMA foreign_keys = ON');

  await applyMigrations(client);

  db = drizzle(client, { schema });
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error('initDb() has not run yet');
  return db;
}

export async function closeDb(): Promise<void> {
  client?.close();
  client = undefined;
  db = undefined;
}

export { schema };
