import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import type { Db } from './index.js';
import { applyMigrations } from './migrate.js';
import * as schema from './schema.js';

export interface TestDb {
  db: Db;
  client: Client;
  close: () => void;
}

/**
 * A migrated in-memory database. Uses the real migration files rather than a
 * hand-maintained schema, so a migration that is wrong in production is wrong
 * in the tests too.
 */
export async function createTestDb(): Promise<TestDb> {
  const client = createClient({ url: ':memory:' });
  await client.execute('PRAGMA foreign_keys = ON');
  await applyMigrations(client);

  return {
    client,
    db: drizzle(client, { schema }),
    close: () => client.close(),
  };
}
