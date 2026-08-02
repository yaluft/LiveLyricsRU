import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config.js';

let singleton: Database.Database | null = null;

export function createDb(path: string): Database.Database {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS lyrics_cache (
      track_id     TEXT PRIMARY KEY,
      found        INTEGER NOT NULL,
      kind         TEXT,
      source       TEXT,
      source_label TEXT,
      payload      TEXT,
      fetched_at   INTEGER NOT NULL,
      expires_at   INTEGER NOT NULL
    );
  `);
  return db;
}

export function getDb(): Database.Database {
  if (!singleton) singleton = createDb(config.sqlitePath);
  return singleton;
}

export function pruneExpiredLyricsCache(db: Database.Database = getDb()): void {
  db.prepare('DELETE FROM lyrics_cache WHERE expires_at < ?').run(Date.now());
}

setInterval(() => pruneExpiredLyricsCache(), 6 * 60 * 60 * 1000).unref();
