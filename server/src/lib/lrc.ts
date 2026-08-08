import type { LyricLine } from '@lyrika/shared';
import { splitWords, transliterate } from './transliterate.js';

const TIMESTAMP_RE = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const WORD_TAG_RE = /<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>/g;

interface Stamped {
  time: number;
  text: string;
  /** Real per-word offsets (seconds from `time`), when the line carried enhanced-LRC `<mm:ss.xx>` word tags. */
  wordOffsets?: number[];
}

function parseTimeParts(min: string, sec: string, fracRaw: string | undefined): number {
  const frac = fracRaw ? Number(fracRaw) / 10 ** fracRaw.length : 0;
  return Number(min) * 60 + Number(sec) + frac;
}

/**
 * Strips inline enhanced-LRC word tags (`<mm:ss.xx>word `) out of a line,
 * returning the clean display text plus each tagged word's offset from
 * `lineTime`. Lines without any such tags pass through unchanged. Without this,
 * the tags survive as literal `<00:12.34>` text in what's displayed — the app
 * had no other code path that produced or expected them, so they were never
 * stripped, only left in place.
 */
function stripWordTags(text: string, lineTime: number): { text: string; offsets: number[] } {
  const matches = [...text.matchAll(WORD_TAG_RE)];
  if (!matches.length) return { text, offsets: [] };

  const firstIndex = matches[0]?.index ?? 0;
  let clean = text.slice(0, firstIndex);
  const offsets: number[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    if (!m || m.index === undefined) continue;
    const abs = parseTimeParts(m[1] ?? '0', m[2] ?? '0', m[3]);
    const segStart = m.index + m[0].length;
    const segEnd = matches[i + 1]?.index ?? text.length;
    const segment = text.slice(segStart, segEnd);
    if (segment.trim()) offsets.push(Math.max(abs - lineTime, 0));
    clean += segment;
  }
  return { text: clean.replace(/\s+/g, ' ').trim(), offsets };
}

/** Parses an LRC body. Multi-timestamp lines are expanded into one line each. */
export function parseLrc(body: string): Stamped[] {
  const out: Stamped[] = [];
  for (const rawLine of body.split(/\r?\n/)) {
    TIMESTAMP_RE.lastIndex = 0;
    const times: number[] = [];
    let lastEnd = 0;
    for (const m of rawLine.matchAll(TIMESTAMP_RE)) {
      times.push(parseTimeParts(m[1] ?? '0', m[2] ?? '0', m[3]));
      lastEnd = (m.index ?? 0) + m[0].length;
    }
    if (!times.length) continue;
    const rawText = rawLine.slice(lastEnd).trim();
    if (!rawText) continue;
    for (const time of times) {
      const { text, offsets } = stripWordTags(rawText, time);
      if (!text) continue;
      out.push({ time, text, ...(offsets.length ? { wordOffsets: offsets } : {}) });
    }
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

/**
 * Turns timestamped text into the app's line model, deriving word timings.
 * Uses a line's real `wordOffsets` (from enhanced-LRC word tags) whenever their
 * count matches our own tokenizer; otherwise falls back to an even split across
 * the line so a tag/tokenizer mismatch can't misalign the highlight.
 */
export function toLyricLines(stamped: Stamped[], totalDurationSec: number): LyricLine[] {
  return stamped.map((line, i) => {
    const next = stamped[i + 1];
    const end = next ? next.time : Math.max(line.time + 4, totalDurationSec);
    const span = Math.max(end - line.time, 0.6);
    const words = splitWords(line.text);
    const realOffsets = line.wordOffsets;
    const useReal = !!realOffsets && realOffsets.length === words.length;
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
        offset: useReal ? (realOffsets as number[])[wi] ?? 0 : words.length > 1 ? (span * wi) / words.length : 0,
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
