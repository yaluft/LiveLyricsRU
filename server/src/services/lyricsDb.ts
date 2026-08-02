import type { LyricLine, Lyrics, LyricsRecord, LyricsSaveRequest } from '@lyrika/shared';
import { JsonStore } from '../lib/store.js';
import { parseLrc, plainToLyricLines, toLyricLines } from '../lib/lrc.js';

const store = new JsonStore<Record<string, LyricsRecord>>('lyrics-db', {});

const LRC_STAMP_RE = /\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/;
const DEFAULT_DURATION_SEC = 240;

function recordToLyrics(record: LyricsRecord): Lyrics {
  return {
    trackId: record.trackId,
    kind: record.kind,
    source: record.source,
    sourceLabel: record.sourceLabel,
    lines: record.lines,
    userEdited: record.userEdited,
  };
}

function parseBody(body: string, durationSec: number): { kind: 'synced' | 'plain'; lines: LyricLine[] } {
  const synced = LRC_STAMP_RE.test(body);
  const lines = synced ? toLyricLines(parseLrc(body), durationSec) : plainToLyricLines(body, durationSec);
  if (!lines.length) throw new Error('Не удалось разобрать текст: не нашли ни одной строки');
  return { kind: synced ? 'synced' : 'plain', lines };
}

export async function readStoredLyrics(trackId: string): Promise<Lyrics | undefined> {
  const record = (await store.read())[trackId];
  return record ? recordToLyrics(record) : undefined;
}

export async function readRecord(trackId: string): Promise<LyricsRecord | undefined> {
  return (await store.read())[trackId];
}

/** User edits and scraped fallbacks both land here for reuse. */
export async function writeStoredLyrics(
  req: LyricsSaveRequest,
  meta: { source: LyricsRecord['source']; sourceLabel: string; userEdited: boolean },
): Promise<Lyrics> {
  const body = req.body ?? '';
  const duration =
    typeof req.durationSec === 'number' && req.durationSec > 0
      ? req.durationSec
      : DEFAULT_DURATION_SEC;

  const parsed = parseBody(body, duration);
  const now = Date.now();
  const existing = (await store.read())[req.trackId];

  const record: LyricsRecord = {
    trackId: req.trackId,
    kind: parsed.kind,
    source: meta.userEdited ? 'custom' : meta.source,
    sourceLabel: meta.userEdited ? 'Свой текст' : meta.sourceLabel,
    lrcBody: parsed.kind === 'synced' ? body : undefined,
    lines: parsed.lines,
    userEdited: meta.userEdited,
    originalLines: meta.userEdited ? existing?.originalLines ?? existing?.lines : undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await store.update((current) => ({ ...current, [req.trackId]: record }));
  return recordToLyrics(record);
}

/** Cache a remote hit so the next request skips external sources. */
export async function cacheRemoteLyrics(lyrics: Lyrics, lrcBody?: string): Promise<void> {
  const now = Date.now();
  const record: LyricsRecord = {
    trackId: lyrics.trackId,
    kind: lyrics.kind,
    source: lyrics.source,
    sourceLabel: lyrics.sourceLabel,
    lrcBody,
    lines: lyrics.lines,
    userEdited: false,
    createdAt: now,
    updatedAt: now,
  };
  await store.update((current) => {
    const existing = current[lyrics.trackId];
    if (existing?.userEdited) return current;
    return { ...current, [lyrics.trackId]: record };
  });
}

export async function deleteStoredLyrics(trackId: string): Promise<void> {
  await store.update((current) => {
    if (!(trackId in current)) return current;
    const next = { ...current };
    delete next[trackId];
    return next;
  });
}
