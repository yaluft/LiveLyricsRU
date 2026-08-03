import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Client } from '@libsql/client';

/**
 * Applies every `.sql` file in `drizzle/` exactly once, in filename order.
 *
 * Deliberately not drizzle-kit's own migrator: the FTS5 virtual table and its
 * triggers have no Drizzle schema representation, so they have to arrive as a
 * hand-written file alongside the generated ones. A plain "apply unapplied
 * files in order" runner treats both the same, with no journal to keep in sync.
 */
const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle');

export async function applyMigrations(client: Client): Promise<string[]> {
  await client.execute(
    `CREATE TABLE IF NOT EXISTS _migrations (
       name TEXT PRIMARY KEY,
       applied_at INTEGER NOT NULL
     )`,
  );

  const applied = new Set(
    (await client.execute('SELECT name FROM _migrations')).rows.map((row) => String(row.name)),
  );

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const ran: string[] = [];
  for (const name of files) {
    if (applied.has(name)) continue;

    const sql = await readFile(join(MIGRATIONS_DIR, name), 'utf8');
    const statements = sql
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean);

    // A migration must not land half-applied, or the next boot re-runs its
    // first half against a database that already has it.
    await client.batch([...statements, {
      sql: 'INSERT INTO _migrations (name, applied_at) VALUES (?, ?)',
      args: [name, Date.now()],
    }], 'write');

    ran.push(name);
  }

  return ran;
}
