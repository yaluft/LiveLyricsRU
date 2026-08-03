import type { LyricLine, LyricWord, ParsedLyrics, TimingKind } from '../types.js';
import { romanise, splitWords } from '../romanise.js';

/** `[mm:ss.xx]` line stamps. Minutes may run past 99; the fraction is 1–3 digits. */
const LINE_STAMP_RE = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
/** `<mm:ss.xx>` word stamps — the "Enhanced LRC" / A2 extension. */
const WORD_STAMP_RE = /<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>/g;

function toMs(min: string, sec: string, frac: string | undefined): number {
  const fracMs = frac === undefined ? 0 : (Number(frac) / 10 ** frac.length) * 1000;
  return Number(min) * 60_000 + Number(sec) * 1000 + Math.round(fracMs);
}

interface RawChunk {
  startMs: number;
  text: string;
}

/** Splits an A2 line body into its timed word chunks. Empty when the line has no word stamps. */
function parseWordStamps(body: string): RawChunk[] {
  const matches = [...body.matchAll(WORD_STAMP_RE)];
  if (matches.length === 0) return [];

  const chunks: RawChunk[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]!;
    const from = (match.index ?? 0) + match[0].length;
    const next = matches[i + 1];
    const to = next?.index ?? body.length;
    const text = body.slice(from, to).trim();
    if (!text) continue;
    chunks.push({ startMs: toMs(match[1]!, match[2]!, match[3]), text });
  }

  // Text sitting before the first stamp (rare, but valid) belongs to the first
  // timed chunk rather than becoming an untimed orphan.
  const firstIndex = matches[0]?.index ?? 0;
  const lead = body.slice(0, firstIndex).trim();
  const first = chunks[0];
  if (lead && first) first.text = `${lead} ${first.text}`;

  return chunks;
}

interface RawLine {
  startMs: number;
  text: string;
  chunks: RawChunk[];
}

/**
 * Parses an LRC body, plain or Enhanced (A2).
 *
 * Multi-timestamp lines (`[00:12.00][01:30.00]припев`) are expanded into one
 * line per timestamp — a chorus written once but sung three times has to become
 * three lines or the highlight stops on its second occurrence.
 */
export function parseLrc(body: string): ParsedLyrics {
  const raw: RawLine[] = [];
  let sawWordStamps = false;

  for (const line of body.split(/\r?\n/)) {
    LINE_STAMP_RE.lastIndex = 0;
    const stamps: number[] = [];
    let bodyStart = 0;

    for (const match of line.matchAll(LINE_STAMP_RE)) {
      // Only leading stamps count. `[00:01.00]a [00:02.00]b` is one line whose
      // text happens to contain a bracket, not two lines.
      if ((match.index ?? 0) !== bodyStart) break;
      stamps.push(toMs(match[1]!, match[2]!, match[3]));
      bodyStart = (match.index ?? 0) + match[0].length;
    }

    if (stamps.length === 0) continue; // ID tag (`[ar:…]`) or blank — skip.

    const rest = line.slice(bodyStart);
    const chunks = parseWordStamps(rest);
    if (chunks.length > 0) sawWordStamps = true;

    const text = (chunks.length > 0 ? chunks.map((c) => c.text).join(' ') : rest).trim();
    if (!text) continue;

    for (const startMs of stamps) {
      // Each repeat needs its own chunk times, shifted to that occurrence.
      const delta = startMs - stamps[0]!;
      raw.push({
        startMs,
        text,
        chunks: chunks.map((c) => ({ startMs: c.startMs + delta, text: c.text })),
      });
    }
  }

  raw.sort((a, b) => a.startMs - b.startMs);

  const timingKind: TimingKind = sawWordStamps ? 'word' : 'line';
  const lines = raw.map((line, idx) => {
    const endMs = raw[idx + 1]?.startMs ?? null;
    return buildLine(idx, line, endMs);
  });

  return { kind: 'synced', timingKind, lines };
}

function buildLine(idx: number, raw: RawLine, endMs: number | null): LyricLine {
  const words: LyricWord[] =
    raw.chunks.length > 0
      ? raw.chunks.map((chunk, i) => ({
          text: chunk.text,
          romanised: romanise(chunk.text),
          startMs: chunk.startMs,
          endMs: raw.chunks[i + 1]?.startMs ?? endMs,
        }))
      : splitWords(raw.text).map((word) => ({
          text: word.text,
          romanised: romanise(word.text),
          // No source timing. Interpolation, if any, is the view's job — see
          // `interpolateWords` — so that a derived value never gets persisted
          // as though it came from the source.
          startMs: null,
          endMs: null,
        }));

  return {
    idx,
    startMs: raw.startMs,
    endMs,
    text: raw.text,
    romanised: romanise(raw.text),
    words,
  };
}

/** Unsynced lyrics: real text, no timing, and honest about it. */
export function parsePlainLyrics(body: string): ParsedLyrics {
  const lines = body
    .split(/\r?\n/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map<LyricLine>((text, idx) => ({
      idx,
      startMs: null,
      endMs: null,
      text,
      romanised: romanise(text),
      words: splitWords(text).map((word) => ({
        text: word.text,
        romanised: romanise(word.text),
        startMs: null,
        endMs: null,
      })),
    }));

  return { kind: 'plain', timingKind: 'none', lines };
}

/** True when the body carries at least one leading `[mm:ss]` stamp. */
export function looksLikeLrc(body: string): boolean {
  return body.split(/\r?\n/).some((line) => /^\s*\[\d{1,3}:\d{2}/.test(line));
}

export function parseLyrics(body: string): ParsedLyrics {
  return looksLikeLrc(body) ? parseLrc(body) : parsePlainLyrics(body);
}
