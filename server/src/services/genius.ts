import type { Lyrics, Track } from '@lyrika/shared';
import { plainToLyricLines } from '../lib/lrc.js';

interface OvhResponse {
  lyrics?: string;
  error?: string;
}

/**
 * Keyless lyrics fallback via lyrics.ovh. Plain text only — timings are spread
 * evenly. Results are cached in lyricsDb by the unified resolver.
 */
export async function fetchLyrics(track: Track): Promise<Lyrics | null> {
  if (!track.artist.trim() || !track.title.trim()) return null;

  const artist = encodeURIComponent(track.artist.trim());
  const title = encodeURIComponent(track.title.trim());
  const url = `https://api.lyrics.ovh/v1/${artist}/${title}`;

  let payload: OvhResponse;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    payload = (await res.json()) as OvhResponse;
  } catch {
    return null;
  }

  const body = payload.lyrics?.trim();
  if (!body || payload.error) return null;

  const lines = plainToLyricLines(body, track.durationSec || 240);
  if (!lines.length) return null;

  return {
    trackId: track.id,
    kind: 'plain',
    source: 'genius',
    sourceLabel: 'Genius (только текст)',
    lines,
  };
}
