import type Database from 'better-sqlite3';
import type { Lyrics } from '@lyrika/shared';
import { getDb } from '../lib/db.js';
import { config } from '../config.js';

interface LyricsCacheRow {
  found: number;
  kind: string | null;
  source: string | null;
  source_label: string | null;
  payload: string | null;
  expires_at: number;
}

/**
 * Front door for the LRCLIB → NetEase → demo-catalogue waterfall in
 * `routes/lyrics.ts`. `null` means "no usable cache entry, run the live
 * chain"; `'not_found'` means "we already know this track has no lyrics
 * anywhere, don't hit LRCLIB/NetEase again". A cache read/write failure must
 * never fail the actual request, so both functions swallow their own errors.
 */
export function getCachedLyrics(trackId: string, db: Database.Database = getDb()): Lyrics | 'not_found' | null {
  try {
    const row = db
      .prepare('SELECT found, kind, source, source_label, payload, expires_at FROM lyrics_cache WHERE track_id = ?')
      .get(trackId) as LyricsCacheRow | undefined;
    if (!row) return null;
    if (row.expires_at < Date.now()) return null;
    if (!row.found) return 'not_found';
    if (!row.kind || !row.source || !row.source_label || !row.payload) return null;
    return {
      trackId,
      kind: row.kind as Lyrics['kind'],
      source: row.source as Lyrics['source'],
      sourceLabel: row.source_label,
      lines: JSON.parse(row.payload) as Lyrics['lines'],
    };
  } catch {
    return null;
  }
}

export function setCachedLyrics(trackId: string, lyrics: Lyrics | null, db: Database.Database = getDb()): void {
  try {
    const now = Date.now();
    const ttl = lyrics ? config.lyricsCacheTtlMs : config.lyricsNotFoundTtlMs;
    db.prepare(
      `INSERT INTO lyrics_cache (track_id, found, kind, source, source_label, payload, fetched_at, expires_at)
       VALUES (@trackId, @found, @kind, @source, @sourceLabel, @payload, @fetchedAt, @expiresAt)
       ON CONFLICT(track_id) DO UPDATE SET
         found = excluded.found,
         kind = excluded.kind,
         source = excluded.source,
         source_label = excluded.source_label,
         payload = excluded.payload,
         fetched_at = excluded.fetched_at,
         expires_at = excluded.expires_at`,
    ).run({
      trackId,
      found: lyrics ? 1 : 0,
      kind: lyrics?.kind ?? null,
      source: lyrics?.source ?? null,
      sourceLabel: lyrics?.sourceLabel ?? null,
      payload: lyrics ? JSON.stringify(lyrics.lines) : null,
      fetchedAt: now,
      expiresAt: now + ttl,
    });
  } catch {
    // A cache write failure must never fail the actual lyrics request.
  }
}
