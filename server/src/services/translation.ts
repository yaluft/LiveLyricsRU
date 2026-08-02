import { createHash } from 'node:crypto';
import type { LyricLine, Lyrics } from '@lyrika/shared';
import { JsonStore } from '../lib/store.js';
import { claudeAvailable, translateLines } from './claude.js';

interface CachedTranslation {
  /** Hash of the joined line texts, so edited lyrics re-translate. */
  hash: string;
  translations: string[];
}

const store = new JsonStore<Record<string, CachedTranslation>>('lyric-translations', {});

function hashLines(lines: LyricLine[]): string {
  return createHash('sha256')
    .update(lines.map((line) => line.text).join('\n'))
    .digest('hex');
}

function apply(lyrics: Lyrics, translations: string[]): Lyrics {
  return {
    ...lyrics,
    lines: lyrics.lines.map((line, i) => {
      if (line.translation.trim()) return line;
      const translation = translations[i] ?? '';
      return translation ? { ...line, translation } : line;
    }),
  };
}

/**
 * Fills in the English row when a key is configured. Never throws: a missing
 * key, a network blip or a refusal all leave the lyrics exactly as they were,
 * because the Russian text plus romanisation is already a complete answer.
 */
export async function enrichWithTranslation(
  lyrics: Lyrics,
  ctx: { title: string; artist: string },
): Promise<Lyrics> {
  try {
    if (!lyrics.lines.length) return lyrics;
    // Demo-catalogue lines ship with translations already.
    if (lyrics.lines.every((line) => line.translation.trim() !== '')) return lyrics;

    const hash = hashLines(lyrics.lines);
    const cached = (await store.read())[lyrics.trackId];
    if (cached && cached.hash === hash) return apply(lyrics, cached.translations);

    if (!claudeAvailable()) return lyrics;

    const translations = await translateLines(
      lyrics.lines.map((line) => line.text),
      ctx,
    );
    if (!translations.some((t) => t.trim() !== '')) return lyrics;

    await store.update((current) => ({ ...current, [lyrics.trackId]: { hash, translations } }));
    return apply(lyrics, translations);
  } catch {
    return lyrics;
  }
}
