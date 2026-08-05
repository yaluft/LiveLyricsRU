import type { Lyrics, Track } from '@lyrika/shared';
import { config } from '../config.js';
import { parseLrc, toLyricLines, plainToLyricLines } from '../lib/lrc.js';

interface NeteaseArtist {
  name: string;
}

interface NeteaseSong {
  id: number;
  name: string;
  artists: NeteaseArtist[];
  duration: number | null;
}

interface NeteaseSearchResponse {
  code: number;
  result?: {
    songs?: NeteaseSong[];
  };
}

interface NeteaseLyricResponse {
  code: number;
  lrc?: { lyric: string | null };
  tlyric?: { lyric: string | null };
}

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

async function getJson(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(path, config.neteaseBaseUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const signal = AbortSignal.timeout(config.neteaseTimeoutMs);
  const res = await fetch(url, { signal, headers: HEADERS });
  if (!res.ok) throw new Error(`NetEase ${res.status}`);
  return res.json();
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Prefers songs whose artist name roughly matches the query artist. */
function rankSongs(songs: NeteaseSong[], artist: string): NeteaseSong[] {
  const needle = normalize(artist);
  if (!needle) return songs;
  const scored = songs.map((song) => {
    const hay = normalize(song.artists.map((a) => a.name).join(' '));
    return { song, match: hay.includes(needle) || needle.includes(hay) };
  });
  scored.sort((a, b) => Number(b.match) - Number(a.match));
  return scored.map((s) => s.song);
}

async function fetchLyricById(id: number, track: Track): Promise<Lyrics | null> {
  const data = (await getJson('/api/song/lyric', {
    id: String(id),
    lv: '1',
  }).catch(() => null)) as NeteaseLyricResponse | null;
  if (!data || data.code !== 200) return null;

  const rawLrc = data.lrc?.lyric;
  if (rawLrc) {
    const lines = toLyricLines(parseLrc(rawLrc), track.durationSec || 240);
    if (lines.length) {
      return {
        trackId: track.id,
        kind: 'synced',
        source: 'netease',
        sourceLabel: 'NetEase Cloud Music (синхро)',
        lines,
      };
    }
    // Synced parsing failed (e.g. unusual formatting) but there was raw text: fall back to plain.
    const plainLines = plainToLyricLines(
      rawLrc.replace(/\[[^\]]*\]/g, ''),
      track.durationSec || 240,
    );
    if (plainLines.length) {
      return {
        trackId: track.id,
        kind: 'plain',
        source: 'netease',
        sourceLabel: 'NetEase Cloud Music (только текст)',
        lines: plainLines,
      };
    }
  }
  return null;
}

export async function fetchLyrics(track: Track): Promise<Lyrics | null> {
  const query = [track.artist, track.title].filter(Boolean).join(' ');
  if (!query.trim()) return null;

  const search = (await getJson('/api/search/pc', {
    s: query,
    limit: '10',
    type: '1',
    offset: '0',
  }).catch(() => null)) as NeteaseSearchResponse | null;

  const songs = search?.result?.songs;
  if (!Array.isArray(songs) || !songs.length) return null;

  for (const song of rankSongs(songs, track.artist)) {
    const lyrics = await fetchLyricById(song.id, track);
    if (lyrics) return lyrics;
  }
  return null;
}
