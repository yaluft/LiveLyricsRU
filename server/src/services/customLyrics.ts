import type { Lyrics } from '@lyrika/shared';
import { JsonStore } from '../lib/store.js';
import { parseLrc, plainToLyricLines, toLyricLines } from '../lib/lrc.js';

/**
 * User-pasted lyrics. When a song resolves no lyrics from any provider, the user
 * can paste an LRC (e.g. from lrcsong.com) and it's stored per track, so it wins
 * on the next load. Synced if the paste carries `[mm:ss.xx]` timestamps, plain
 * otherwise. Reuses the same LRC parser as the network sources.
 */
const store = new JsonStore<Record<string, { lrc: string; durationSec: number }>>(
  'custom-lyrics',
  {},
);

/** Builds a Lyrics object from a raw LRC/plain-text paste, or null if empty. */
export function lyricsFromLrc(trackId: string, lrc: string, durationSec: number): Lyrics | null {
  const duration = durationSec || 240;
  const stamped = parseLrc(lrc);
  if (stamped.length) {
    const lines = toLyricLines(stamped, duration);
    if (lines.length) {
      return {
        trackId,
        kind: 'synced',
        source: 'custom',
        sourceLabel: 'Свой текст (LRC)',
        lines,
      };
    }
  }
  // No timestamps: treat it as plain text, dropping any stray bracket tags.
  const plainLines = plainToLyricLines(lrc.replace(/\[[^\]]*\]/g, ''), duration);
  if (plainLines.length) {
    return {
      trackId,
      kind: 'plain',
      source: 'custom',
      sourceLabel: 'Свой текст',
      lines: plainLines,
    };
  }
  return null;
}

export async function saveCustomLyrics(
  trackId: string,
  lrc: string,
  durationSec: number,
): Promise<Lyrics | null> {
  const lyrics = lyricsFromLrc(trackId, lrc, durationSec);
  if (!lyrics) return null;
  await store.update((current) => ({ ...current, [trackId]: { lrc, durationSec } }));
  return lyrics;
}

export async function getCustomLyrics(trackId: string): Promise<Lyrics | null> {
  const current = await store.read();
  const entry = current[trackId];
  if (!entry) return null;
  return lyricsFromLrc(trackId, entry.lrc, entry.durationSec);
}

export async function deleteCustomLyrics(trackId: string): Promise<void> {
  await store.update((current) => {
    if (!(trackId in current)) return current;
    const next = { ...current };
    delete next[trackId];
    return next;
  });
}
