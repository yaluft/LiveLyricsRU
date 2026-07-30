export interface TrackInfo {
  streamUrl: string;
  title: string;
  artist: string;
  thumbnail: string;
  durationSec: number | null;
  source: 'youtube' | 'vk' | 'spotify' | 'direct';
}

export interface SearchResult {
  title: string;
  artist: string;
  thumbnail: string;
  durationSec: number | null;
  youtubeUrl: string;
}

export interface LyricsResult {
  trackName: string;
  artistName: string;
  syncedLyrics: string | null;
  plainLyrics: string | null;
}

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const resp = await fetch(`${path}?${qs}`);
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ error: resp.statusText })) as { error?: string };
    throw new Error(body.error ?? resp.statusText);
  }
  return resp.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const b = await resp.json().catch(() => ({ error: resp.statusText })) as { error?: string };
    throw new Error(b.error ?? resp.statusText);
  }
  return resp.json() as Promise<T>;
}

export function apiSearch(q: string): Promise<SearchResult[]> {
  return get<SearchResult[]>('/api/search', { q });
}

export function apiResolve(url: string): Promise<TrackInfo> {
  return get<TrackInfo>('/api/resolve', { url });
}

export function apiStreamUrl(streamUrl: string): string {
  return `/api/stream?url=${encodeURIComponent(streamUrl)}`;
}

export function apiLyrics(artist: string, title: string): Promise<LyricsResult> {
  return get<LyricsResult>('/api/lyrics', { artist, title });
}

export function apiRelated(artist: string, title?: string): Promise<SearchResult[]> {
  return get<SearchResult[]>('/api/related', { artist, title: title ?? '' });
}

/** Translate an array of Russian lines to English. Returns same-length array. */
export async function apiTranslate(lines: string[]): Promise<string[]> {
  const result = await post<{ translations: string[] }>('/api/translate', { lines });
  return result.translations;
}

/** Get romanised pronunciation for an array of Russian words (unused — handled client-side). */
export async function apiPronounce(words: string[]): Promise<string[]> {
  const result = await post<{ pronunciations: string[] }>('/api/pronounce', { words });
  return result.pronunciations;
}
