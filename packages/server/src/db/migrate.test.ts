import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClient, type Client } from '@libsql/client';
import { foldSearchText } from '@lyrika/core';
import { applyMigrations } from './migrate.js';

let client: Client;

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  await client.execute('PRAGMA foreign_keys = ON');
});

afterEach(() => {
  client.close();
});

async function tableNames(): Promise<string[]> {
  const result = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
  return result.rows.map((row) => String(row.name));
}

describe('applyMigrations', () => {
  it('creates every table', async () => {
    await applyMigrations(client);

    const names = await tableNames();
    for (const table of [
      'tracks',
      'lyrics',
      'lyric_lines',
      'lyric_words',
      'translations',
      'uploads',
      'vocab_entries',
      'srs_cards',
      'srs_reviews',
      'kv',
      'lyric_lines_fts',
    ]) {
      expect(names).toContain(table);
    }
  });

  it('is idempotent — a second run applies nothing', async () => {
    const first = await applyMigrations(client);
    const second = await applyMigrations(client);

    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual([]);
  });

  it('enforces foreign keys, so a cascade delete actually cascades', async () => {
    await applyMigrations(client);
    await seedLine('Где свет никогда не гаснет');

    await client.execute("DELETE FROM tracks WHERE id = 'upload:t1'");

    const lines = await client.execute('SELECT COUNT(*) AS n FROM lyric_lines');
    expect(Number(lines.rows[0]?.n)).toBe(0);
  });
});

/**
 * The plan flagged Cyrillic FTS5 tokenisation as something to verify rather
 * than assume — `unicode61` is Unicode-aware in principle, but "in principle"
 * is not a test.
 */
describe('lyric_lines_fts — Cyrillic search', () => {
  beforeEach(async () => {
    await applyMigrations(client);
  });

  /**
   * Mirrors what the search route does: fold the query the same way the
   * indexing triggers fold the text, then join back for the *original* text —
   * the index holds a folded copy, so it must never be what gets displayed.
   */
  async function search(query: string): Promise<string[]> {
    const result = await client.execute({
      sql: `SELECT l.text AS text
              FROM lyric_lines_fts f
              JOIN lyric_lines l ON l.id = f.rowid
             WHERE lyric_lines_fts MATCH ?
             ORDER BY rank`,
      args: [foldSearchText(query)],
    });
    return result.rows.map((row) => String(row.text));
  }

  it('tokenises Cyrillic words', async () => {
    await seedLine('Где свет никогда не гаснет');

    expect(await search('свет')).toEqual(['Где свет никогда не гаснет']);
    expect(await search('гаснет')).toEqual(['Где свет никогда не гаснет']);
  });

  it('is case-insensitive across Cyrillic case pairs', async () => {
    await seedLine('Небо над городом');

    expect(await search('НЕБО')).toHaveLength(1);
    expect(await search('небо')).toHaveLength(1);
  });

  it('folds ё to е, which writers use interchangeably', async () => {
    await seedLine('Ещё один день');

    expect(await search('еще')).toHaveLength(1);
    expect(await search('ещё')).toHaveLength(1);
  });

  it('supports prefix search', async () => {
    await seedLine('Где свет никогда не гаснет');

    expect(await search('никог*')).toHaveLength(1);
  });

  it('does not match a word that is absent', async () => {
    await seedLine('Где свет никогда не гаснет');

    expect(await search('море')).toEqual([]);
  });

  it('keeps the index in step when a line is deleted', async () => {
    await seedLine('Где свет никогда не гаснет');
    await client.execute('DELETE FROM lyric_lines');

    expect(await search('свет')).toEqual([]);
  });

  it('keeps the index in step when a line is edited', async () => {
    await seedLine('Где свет никогда не гаснет');
    await client.execute("UPDATE lyric_lines SET text = 'Море волнуется раз'");

    expect(await search('свет')).toEqual([]);
    expect(await search('море')).toEqual(['Море волнуется раз']);
  });
});

async function seedLine(text: string): Promise<void> {
  await client.execute({
    sql: `INSERT OR IGNORE INTO tracks (id, provider, provider_id, title, artist, duration_sec, created_at)
          VALUES ('upload:t1', 'upload', 't1', 'Тест', 'Тест', 100, 0)`,
    args: [],
  });
  await client.execute({
    sql: `INSERT OR IGNORE INTO lyrics (id, track_id, source_id, kind, timing_kind, raw, fetched_at)
          VALUES (1, 'upload:t1', 'upload', 'synced', 'line', '', 0)`,
    args: [],
  });
  await client.execute({
    sql: `INSERT INTO lyric_lines (lyrics_id, idx, start_ms, end_ms, text, romanised)
          VALUES (1, (SELECT COUNT(*) FROM lyric_lines), 0, 1000, ?, '')`,
    args: [text],
  });
}
