import type { LyricLine } from '@lyrika/shared';
import { plainToLyricLines, toLyricLines, parseLrc } from '../lib/lrc.js';

function pad(n: number, width = 2) {
  return String(n).padStart(width, '0');
}

function formatTimestamp(timeSec: number): string {
  const mm = Math.floor(timeSec / 60);
  const ss = Math.floor(timeSec % 60);
  const frac = Math.floor((timeSec - Math.floor(timeSec)) * 100); // centiseconds
  return `[${pad(mm)}:${pad(ss)}.${pad(frac, 2)}]`;
}

export function linesToLrc(lines: LyricLine[]): string {
  return lines
    .map((line) => `${formatTimestamp(line.time)}${line.text}`)
    .join('\n');
}

/** Generate an LRC string from plain (unsynced) text by evenly spacing lines. */
export function generateLrcFromPlain(body: string, durationSec: number): string {
  // Remove bracket tags users sometimes paste, but preserve line breaks.
  const cleaned = body.replace(/\[[^\]]*\]/g, '');
  const texts = cleaned.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!texts.length) return '';

  // Weight line durations by word count so longer lines get proportionally more time.
  const counts = texts.map((t) => t.split(/\s+/).filter(Boolean).length || 1);
  const totalWords = counts.reduce((a, b) => a + b, 0);
  let acc = 0;
  const lines = texts.map((text, i) => {
    const start = (acc / totalWords) * durationSec;
    acc += counts[i];
    return { time: start, text } as any;
  });
  // Derive end times and convert to LyricLine via toLyricLines-compatible stamped format.
  const stamped = lines.map((l) => ({ time: l.time, text: l.text }));
  const lyricLines = toLyricLines(stamped as any, durationSec);
  return linesToLrc(lyricLines);
}

/** Generate an LRC string from already-stamped text (expand multi-timestamps). */
export function generateLrcFromStamped(body: string, durationSec: number): string {
  const stamped = parseLrc(body);
  const lines = toLyricLines(stamped, durationSec);
  return linesToLrc(lines);
}
