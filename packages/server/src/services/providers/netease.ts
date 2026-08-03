import { config } from '../../config.js';
import type { LyricSourceResult } from './lrclib.js';

/**
 * NetEase's undocumented web API. It has no stability guarantee, which is
 * exactly why it sits *behind* LRCLIB in the chain rather than in front of it:
 * when it breaks, the app degrades rather than stops.
 */
const BASE = 'https://music.163.com';

interface NeteaseSong {
  id?: number;
  name?: string;
  artists?: { name?: string }[];
  duration?: number;
}

async function post(path: string, body: Record<string, string>): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.lyricsTimeoutMs);
  try {
    const response = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: BASE,
        // This endpoint refuses obvious bots outright.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      },
      body: new URLSearchParams(body).toString(),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * Reorders hits so an artist match wins. NetEase's own relevance ranking is
 * tuned for its catalogue, and for Russian queries the top hit is regularly a
 * different song with a similar title.
 */
function rank(songs: NeteaseSong[], artist: string, durationSec: number): NeteaseSong[] {
  const wanted = normalise(artist);

  return [...songs].sort((a, b) => score(b) - score(a));

  function score(song: NeteaseSong): number {
    let value = 0;
    const names = (song.artists ?? []).map((entry) => normalise(entry.name ?? ''));
    if (wanted && names.some((name) => name.includes(wanted) || wanted.includes(name))) value += 10;
    if (durationSec > 0 && song.duration) {
      // NetEase reports milliseconds.
      if (Math.abs(song.duration / 1000 - durationSec) <= 5) value += 5;
    }
    return value;
  }
}

/** Strips `[mm:ss.xx]` tags for the plain-text fallback. */
function stripTags(body: string): string {
  return body
    .split(/\r?\n/)
    .map((line) => line.replace(/\[[^\]]*\]/g, '').trim())
    .filter(Boolean)
    .join('\n');
}

export async function fetchFromNetease(
  title: string,
  artist: string,
  durationSec: number,
): Promise<LyricSourceResult | null> {
  if (!title) return null;

  const search = (await post('/api/search/pc', {
    s: `${artist} ${title}`.trim(),
    type: '1',
    offset: '0',
    limit: '10',
  })) as { result?: { songs?: NeteaseSong[] } } | null;

  const songs = search?.result?.songs;
  if (!Array.isArray(songs) || songs.length === 0) return null;

  const best = rank(songs, artist, durationSec)[0];
  if (!best?.id) return null;

  const lyric = (await post('/api/song/lyric', {
    id: String(best.id),
    lv: '-1',
    kv: '-1',
    tv: '-1',
  })) as { lrc?: { lyric?: string }; klyric?: { lyric?: string } } | null;

  const synced = lyric?.lrc?.lyric?.trim();
  if (synced) return { sourceId: 'netease', raw: synced };

  const karaoke = lyric?.klyric?.lyric?.trim();
  if (karaoke) return { sourceId: 'netease', raw: stripTags(karaoke) };

  return null;
}
