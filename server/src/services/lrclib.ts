import type { Lyrics, Track } from '@lyrika/shared';
import { config } from '../config.js';
import { parseLrc, plainToLyricLines, toLyricLines } from '../lib/lrc.js';

interface LrclibHit {
  id: number;
  trackName: string;
  artistName: string;
  duration: number | null;
  syncedLyrics: string | null;
  plainLyrics: string | null;
}

async function getJson(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(path, config.lrclibBaseUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const signal = AbortSignal.timeout(config.lrclibTimeoutMs);
  const res = await fetch(url, {
    signal,
    headers: {
      'User-Agent': 'Lyrika/2.0 (https://github.com/yaluft/LiveLyricsRU)',
      Accept: 'application/json',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`LRCLIB ${res.status}`);
  return res.json();
}

const CYRILLIC_RE = /[Ѐ-ӿ]/;

function hasCyrillic(text: string): boolean {
  return CYRILLIC_RE.test(text);
}

function scriptMismatch(hit: LrclibHit, track: Track): boolean {
  const targetIsCyrillic = hasCyrillic(track.title) || hasCyrillic(track.artist);
  if (!targetIsCyrillic) return false;
  const lyricsText = hit.syncedLyrics || hit.plainLyrics || '';
  return !hasCyrillic(lyricsText);
}

function toLyrics(hit: LrclibHit, track: Track): Lyrics | null {
  if (scriptMismatch(hit, track)) return null;
  if (hit.syncedLyrics) {
    const lines = toLyricLines(parseLrc(hit.syncedLyrics), track.durationSec || hit.duration || 240);
    if (lines.length) {
      return {
        trackId: track.id,
        kind: 'synced',
        source: 'lrclib',
        sourceLabel: 'LRCLIB (синхро)',
        lines,
      };
    }
  }
  if (hit.plainLyrics) {
    const lines = plainToLyricLines(hit.plainLyrics, track.durationSec || hit.duration || 240);
    if (lines.length) {
      return {
        trackId: track.id,
        kind: 'plain',
        source: 'lrclib',
        sourceLabel: 'LRCLIB (только текст)',
        lines,
      };
    }
  }
  return null;
}

export async function fetchLyrics(track: Track): Promise<Lyrics | null> {
  const params: Record<string, string> = {
    track_name: track.title,
    artist_name: track.artist,
  };
  if (track.album) params.album_name = track.album;
  if (track.durationSec) params.duration = String(track.durationSec);

  const exact = (await getJson('/api/get', params).catch(() => null)) as LrclibHit | null;
  if (exact) {
    const lyrics = toLyrics(exact, track);
    if (lyrics) return lyrics;
  }

  const search = (await getJson('/api/search', {
    track_name: track.title,
    artist_name: track.artist,
  }).catch(() => null)) as LrclibHit[] | null;

  if (Array.isArray(search)) {
    for (const hit of search) {
      const lyrics = toLyrics(hit, track);
      if (lyrics) return lyrics;
    }
  }
  return null;
}
