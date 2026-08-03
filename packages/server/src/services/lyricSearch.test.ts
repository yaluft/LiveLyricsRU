import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../db/testing.js';
import { saveLyrics } from './lyrics.js';
import { searchLyricLines } from './lyricSearch.js';

let ctx: TestDb;

const LRC = `[00:00.00]Где свет никогда не гаснет
[00:04.00]Ещё один день
[00:08.00]Море волнуется раз
`;

beforeEach(async () => {
  ctx = await createTestDb();
  await ctx.client.execute({
    sql: `INSERT INTO tracks (id, provider, provider_id, title, artist, duration_sec, created_at)
          VALUES ('upload:t1', 'upload', 't1', 'Тестовая песня', 'Земфира', 120, 0)`,
    args: [],
  });
  await saveLyrics(ctx.db, 'upload:t1', 'upload', LRC);
});

afterEach(() => {
  ctx.close();
});

async function search(query: string): Promise<string[]> {
  return (await searchLyricLines(ctx.db, query)).map((hit) => hit.text);
}

describe('searchLyricLines', () => {
  it('finds a line by a word in it', async () => {
    expect(await search('гаснет')).toEqual(['Где свет никогда не гаснет']);
  });

  it('returns the track and position alongside the line', async () => {
    const [hit] = await searchLyricLines(ctx.db, 'гаснет');

    expect(hit?.trackId).toBe('upload:t1');
    expect(hit?.title).toBe('Тестовая песня');
    expect(hit?.artist).toBe('Земфира');
    expect(hit?.lineIdx).toBe(0);
    expect(hit?.startMs).toBe(0);
  });

  it('is case-insensitive', async () => {
    expect(await search('ГАСНЕТ')).toHaveLength(1);
  });

  it('folds ё to е, which writers use interchangeably', async () => {
    // SQLite's remove_diacritics does not do this — ё is its own codepoint —
    // so both the index and the query are folded explicitly.
    expect(await search('еще')).toEqual(['Ещё один день']);
    expect(await search('ещё')).toEqual(['Ещё один день']);
  });

  it('prefix-matches the last token, for search-as-you-type', async () => {
    expect(await search('никог')).toEqual(['Где свет никогда не гаснет']);
  });

  it('requires all tokens, not any', async () => {
    expect(await search('свет гаснет')).toHaveLength(1);
    expect(await search('свет дельфин')).toHaveLength(0);
  });

  it('returns the ORIGINAL text, not the folded copy held in the index', async () => {
    const [text] = await search('еще');
    expect(text).toBe('Ещё один день');
    expect(text).not.toBe('Еще один день');
  });

  it('returns nothing for a word that is absent', async () => {
    expect(await search('дельфин')).toEqual([]);
  });

  it('returns nothing for an empty or whitespace query', async () => {
    expect(await search('')).toEqual([]);
    expect(await search('   ')).toEqual([]);
  });

  it('respects the limit', async () => {
    expect(await searchLyricLines(ctx.db, 'е', 1)).toHaveLength(1);
  });
});

describe('searchLyricLines — hostile input', () => {
  /**
   * FTS5 treats bare input as an expression language. Left unescaped, an
   * unbalanced quote is a *syntax error* rather than zero results, and a bare
   * `AND` / `NEAR` silently changes the query's meaning. Users type lyric
   * fragments, not expressions.
   */
  it('does not throw on an unbalanced quote', async () => {
    await expect(search('свет"')).resolves.toEqual(expect.any(Array));
    await expect(search('"')).resolves.toEqual(expect.any(Array));
    await expect(search('""')).resolves.toEqual(expect.any(Array));
  });

  it('treats FTS5 operators as literal words', async () => {
    for (const query of ['свет AND гаснет', 'свет OR дельфин', 'свет NEAR гаснет', 'NOT свет']) {
      await expect(search(query), query).resolves.toEqual(expect.any(Array));
    }
  });

  it('does not throw on characters with meaning in the MATCH grammar', async () => {
    for (const query of ['свет:', 'свет*', '(свет', 'свет)', '^свет', 'свет-гаснет', '-']) {
      await expect(search(query), query).resolves.toEqual(expect.any(Array));
    }
  });

  it('does not throw on a query that is only punctuation', async () => {
    await expect(search('!!! ??? ...')).resolves.toEqual(expect.any(Array));
  });

  it('survives an attempt at SQL injection through the query', async () => {
    await expect(search(`'; DROP TABLE lyric_lines; --`)).resolves.toEqual(expect.any(Array));

    // And the table is still there.
    const rows = await ctx.client.execute('SELECT COUNT(*) AS n FROM lyric_lines');
    expect(Number(rows.rows[0]?.n)).toBe(3);
  });
});
