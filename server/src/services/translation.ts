import { createHash } from 'node:crypto';
import type { Lyrics } from '@lyrika/shared';
import { config } from '../config.js';
import { JsonStore } from '../lib/store.js';
import { geminiAvailable, translateBatch } from './gemini.js';

interface TranslateLogger {
  warn(obj: Record<string, unknown>, msg: string): void;
}

/**
 * Fills in `line.translation` for lyrics that arrive without one (LRCLIB and
 * NetEase return the original text only). Translations are cached by a hash of
 * the line text, not by track, so a chorus — or a line shared across songs — is
 * paid for once and reused everywhere.
 *
 * When Gemini is not configured this is a no-op: the lyrics pass through
 * unchanged and the client shows its "no translation" placeholder, exactly as
 * before.
 */
const cache = new JsonStore<Record<string, string>>('translations', {});

function cacheKey(text: string, lang: string): string {
  return `${lang}:${createHash('sha1').update(text).digest('hex')}`;
}

export async function translateLyrics(lyrics: Lyrics, logger?: TranslateLogger): Promise<Lyrics> {
  if (!geminiAvailable()) return lyrics;

  const lang = config.translateTargetLang;
  const store = await cache.read();

  // Resolve from cache first; collect the genuine misses to translate in one call.
  const pending: { index: number; text: string }[] = [];
  const lines = lyrics.lines.map((line, index) => {
    if (line.translation) return line;
    const text = line.text.trim();
    if (!text) return line;
    const cached = store[cacheKey(text, lang)];
    if (cached !== undefined) return { ...line, translation: cached };
    pending.push({ index, text });
    return line;
  });

  if (!pending.length) return { ...lyrics, lines };

  let translated: string[] | null;
  try {
    translated = await translateBatch(
      pending.map((p) => p.text),
      lang,
    );
  } catch (err) {
    logger?.warn({ err }, 'gemini translate failed');
    translated = null;
  }
  if (!translated) return { ...lyrics, lines };

  const updates: Record<string, string> = {};
  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    const value = translated[i]?.trim() ?? '';
    if (!item || !value) continue;
    const current = lines[item.index];
    if (current) lines[item.index] = { ...current, translation: value };
    updates[cacheKey(item.text, lang)] = value;
  }

  if (Object.keys(updates).length) {
    await cache.update((current) => ({ ...current, ...updates }));
  }
  return { ...lyrics, lines };
}
