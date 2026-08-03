import { sql } from 'drizzle-orm';
import { foldSearchText } from '@lyrika/core';
import type { Db } from '../db/index.js';

export interface LyricHit {
  trackId: string;
  title: string;
  artist: string;
  lineIdx: number;
  startMs: number | null;
  text: string;
}

/**
 * Escapes a user query for FTS5's MATCH grammar.
 *
 * FTS5 treats bare input as an expression language — `AND`, `OR`, `NEAR`, `*`,
 * `"` and `:` all mean something. A user typing a lyric fragment means none of
 * that, and an unbalanced quote is a *syntax error*, not zero results. Wrapping
 * each token in double quotes (with internal quotes doubled) makes every token
 * a literal phrase, and the trailing `*` on the last token gives prefix search
 * as you type.
 */
function toMatchExpression(query: string): string {
  const tokens = foldSearchText(query)
    .split(/\s+/)
    .map((token) => token.replace(/"/g, '""').trim())
    .filter(Boolean);

  if (tokens.length === 0) return '';

  return tokens
    .map((token, i) => (i === tokens.length - 1 ? `"${token}"*` : `"${token}"`))
    .join(' ');
}

export async function searchLyricLines(db: Db, query: string, limit = 20): Promise<LyricHit[]> {
  const match = toMatchExpression(query);
  if (!match) return [];

  // The FTS index holds a ё-folded copy of the text, so the original has to be
  // read back from lyric_lines — never from the index.
  const rows = await db.all<{
    track_id: string;
    title: string;
    artist: string;
    idx: number;
    start_ms: number | null;
    text: string;
  }>(sql`
    SELECT t.id AS track_id, t.title, t.artist, l.idx, l.start_ms, l.text
      FROM lyric_lines_fts f
      JOIN lyric_lines l ON l.id = f.rowid
      JOIN lyrics ly ON ly.id = l.lyrics_id
      JOIN tracks t ON t.id = ly.track_id
     WHERE lyric_lines_fts MATCH ${match}
     ORDER BY rank
     LIMIT ${limit}
  `);

  return rows.map((row) => ({
    trackId: row.track_id,
    title: row.title,
    artist: row.artist,
    lineIdx: row.idx,
    startMs: row.start_ms,
    text: row.text,
  }));
}
