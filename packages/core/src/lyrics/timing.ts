import type { LyricLine, LyricWord } from '../types.js';

/**
 * A word with timing guaranteed present — either from the source or interpolated
 * for display. Deliberately a *different type* from `LyricWord`, whose timings
 * are nullable, so that an interpolated value can never be assigned back into
 * the parsed model and persisted as if the source had provided it.
 */
export interface DisplayWord {
  text: string;
  romanised: string;
  startMs: number;
  endMs: number;
  /** False when these timings were derived rather than supplied. */
  exact: boolean;
}

const MIN_LINE_MS = 600;

/**
 * View-only. Spreads a line's span across its words, weighted by character
 * count, so a long word gets proportionally more of the line than a short one.
 *
 * This is what v2 did at parse time and stored — which is why nothing
 * downstream could tell real timings from invented ones. Here it is a render
 * step over a line that self-reports `startMs === null` on its words, and its
 * output is marked `exact: false` so the UI can present it differently.
 */
export function interpolateWords(line: LyricLine, fallbackEndMs?: number): DisplayWord[] {
  const start = line.startMs ?? 0;
  const end = line.endMs ?? fallbackEndMs ?? start + MIN_LINE_MS;
  const span = Math.max(end - start, MIN_LINE_MS);

  const weights = line.words.map((word) => Math.max(word.text.length, 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total === 0) return [];

  let cursor = start;
  return line.words.map((word, i) => {
    const exact = word.startMs !== null;
    if (exact) {
      return {
        text: word.text,
        romanised: word.romanised,
        startMs: word.startMs!,
        endMs: word.endMs ?? end,
        exact: true,
      };
    }
    const wordStart = cursor;
    cursor += (span * weights[i]!) / total;
    return {
      text: word.text,
      romanised: word.romanised,
      startMs: wordStart,
      endMs: i === line.words.length - 1 ? end : cursor,
      exact: false,
    };
  });
}

/**
 * Index of the line active at `positionMs`, or -1 before the first one.
 * Binary search — this runs on every animation frame.
 */
export function activeLineIndex(lines: readonly LyricLine[], positionMs: number): number {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const start = lines[mid]?.startMs;
    if (start === undefined || start === null) break;
    if (positionMs >= start) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

/** Index of the active word within an already-resolved display line, or -1. */
export function activeWordIndex(words: readonly DisplayWord[], positionMs: number): number {
  let found = -1;
  for (let i = 0; i < words.length; i += 1) {
    if (positionMs >= words[i]!.startMs) found = i;
    else break;
  }
  return found;
}

export function hasExactWordTiming(words: readonly LyricWord[]): boolean {
  return words.some((word) => word.startMs !== null);
}
