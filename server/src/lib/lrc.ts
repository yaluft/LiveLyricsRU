import type { LyricLine } from '@lyrika/shared';
import { splitWords, transliterate } from './transliterate.js';

const TIMESTAMP_RE = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

interface Stamped {
  time: number;
  text: string;
}

/** Parses an LRC body. Multi-timestamp lines are expanded into one line each. */
export function parseLrc(body: string): Stamped[] {
  const out: Stamped[] = [];
  for (const rawLine of body.split(/\r?\n/)) {
    TIMESTAMP_RE.lastIndex = 0;
    const times: number[] = [];
    let lastEnd = 0;
    for (const m of rawLine.matchAll(TIMESTAMP_RE)) {
      const min = Number(m[1]);
      const sec = Number(m[2]);
      const fracRaw = m[3] ?? '0';
      const frac = Number(fracRaw) / 10 ** fracRaw.length;
      times.push(min * 60 + sec + frac);
      lastEnd = (m.index ?? 0) + m[0].length;
    }
    if (!times.length) continue;
    const text = rawLine.slice(lastEnd).trim();
    if (!text) continue;
    for (const time of times) out.push({ time, text });
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

/** Turns timestamped text into the app's line model, deriving word timings. */
export function toLyricLines(stamped: Stamped[], totalDurationSec: number): LyricLine[] {
  return stamped.map((line, i) => {
    const next = stamped[i + 1];
    const end = next ? next.time : Math.max(line.time + 4, totalDurationSec);
    const span = Math.max(end - line.time, 0.6);
    const words = splitWords(line.text);
    return {
      id: `l${i}`,
      time: line.time,
      end,
      text: line.text,
      translit: transliterate(line.text),
      translation: '',
      words: words.map((w, wi) => ({
        text: w.text,
        translit: transliterate(w.text),
        offset: words.length > 1 ? (span * wi) / words.length : 0,
      })),
    };
  });
}

/** Fallback for sources that return unsynced text: evenly spread the lines. */
export function plainToLyricLines(body: string, totalDurationSec: number): LyricLine[] {
  const texts = body
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!texts.length) return [];
  const span = totalDurationSec / texts.length;
  return texts.map((text, i) => {
    const words = splitWords(text);
    return {
      id: `l${i}`,
      time: i * span,
      end: (i + 1) * span,
      text,
      translit: transliterate(text),
      translation: '',
      words: words.map((w, wi) => ({
        text: w.text,
        translit: transliterate(w.text),
        offset: words.length > 1 ? (span * wi) / words.length : 0,
      })),
    };
  });
}
