import { and, eq } from 'drizzle-orm';
import { parseLyrics, type ParsedLyrics } from '@lyrika/core';
import type { Db } from '../db/index.js';
import { lyricLines, lyricWords, lyrics } from '../db/schema.js';

export interface StoredLyrics extends ParsedLyrics {
  sourceId: string;
}

/**
 * Parses a raw lyric body and stores it, keeping `raw` alongside the derived
 * rows so a parser fix can re-derive everything without refetching from the
 * source — which matters when the source is a third party that may be gone.
 *
 * `timingKind` is whatever the parser found in the source. Nothing here ever
 * upgrades a `'line'` document to `'word'` by inventing offsets.
 */
export async function saveLyrics(
  db: Db,
  trackId: string,
  sourceId: string,
  raw: string,
): Promise<StoredLyrics> {
  const parsed = parseLyrics(raw);

  await db.delete(lyrics).where(and(eq(lyrics.trackId, trackId), eq(lyrics.sourceId, sourceId)));

  const [row] = await db
    .insert(lyrics)
    .values({
      trackId,
      sourceId,
      kind: parsed.kind,
      timingKind: parsed.timingKind,
      raw,
      fetchedAt: Date.now(),
    })
    .returning({ id: lyrics.id });

  const lyricsId = row!.id;

  for (const line of parsed.lines) {
    const [inserted] = await db
      .insert(lyricLines)
      .values({
        lyricsId,
        idx: line.idx,
        startMs: line.startMs,
        endMs: line.endMs,
        text: line.text,
        romanised: line.romanised,
      })
      .returning({ id: lyricLines.id });

    const lineId = inserted!.id;
    if (line.words.length === 0) continue;

    await db.insert(lyricWords).values(
      line.words.map((word, idx) => ({
        lineId,
        idx,
        startMs: word.startMs,
        endMs: word.endMs,
        text: word.text,
        romanised: word.romanised,
      })),
    );
  }

  return { ...parsed, sourceId };
}

/** Reads back the stored lyrics for a track, newest source first. */
export async function loadLyrics(db: Db, trackId: string): Promise<StoredLyrics | null> {
  const [head] = await db.select().from(lyrics).where(eq(lyrics.trackId, trackId)).limit(1);
  if (!head) return null;

  const lineRows = await db
    .select()
    .from(lyricLines)
    .where(eq(lyricLines.lyricsId, head.id))
    .orderBy(lyricLines.idx);

  const wordRows = await Promise.all(
    lineRows.map((line) =>
      db.select().from(lyricWords).where(eq(lyricWords.lineId, line.id)).orderBy(lyricWords.idx),
    ),
  );

  return {
    sourceId: head.sourceId,
    kind: head.kind,
    timingKind: head.timingKind,
    lines: lineRows.map((line, i) => ({
      idx: line.idx,
      startMs: line.startMs,
      endMs: line.endMs,
      text: line.text,
      romanised: line.romanised,
      words: (wordRows[i] ?? []).map((word) => ({
        text: word.text,
        romanised: word.romanised,
        startMs: word.startMs,
        endMs: word.endMs,
      })),
    })),
  };
}
