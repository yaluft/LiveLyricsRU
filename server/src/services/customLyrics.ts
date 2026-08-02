import type { CustomLyricsRequest, Lyrics } from '@lyrika/shared';
import { JsonStore } from '../lib/store.js';
import { parseLrc, plainToLyricLines, toLyricLines } from '../lib/lrc.js';

/** User-supplied lyrics beat every remote source, so they are stored verbatim. */
const store = new JsonStore<Record<string, Lyrics>>('custom-lyrics', {});

/** A single `[mm:ss]` stamp anywhere in the body is enough to treat it as LRC. */
const LRC_STAMP_RE = /\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/;

const DEFAULT_DURATION_SEC = 240;

export async function readCustomLyrics(trackId: string): Promise<Lyrics | undefined> {
  return (await store.read())[trackId];
}

export async function writeCustomLyrics(req: CustomLyricsRequest): Promise<Lyrics> {
  const body = req.body ?? '';
  const duration =
    typeof req.durationSec === 'number' && req.durationSec > 0
      ? req.durationSec
      : DEFAULT_DURATION_SEC;

  const synced = LRC_STAMP_RE.test(body);
  const lines = synced ? toLyricLines(parseLrc(body), duration) : plainToLyricLines(body, duration);

  if (!lines.length) {
    throw new Error('Не удалось разобрать текст: не нашли ни одной строки');
  }

  const lyrics: Lyrics = {
    trackId: req.trackId,
    kind: synced ? 'synced' : 'plain',
    source: 'custom',
    sourceLabel: 'Свой текст',
    lines,
  };

  await store.update((current) => ({ ...current, [req.trackId]: lyrics }));
  return lyrics;
}

export async function deleteCustomLyrics(trackId: string): Promise<void> {
  await store.update((current) => {
    if (!(trackId in current)) return current;
    const next = { ...current };
    delete next[trackId];
    return next;
  });
}
