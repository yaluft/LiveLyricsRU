import { config } from '../../config.js';

export interface LyricSourceResult {
  sourceId: string;
  raw: string;
}

interface LrclibRecord {
  id?: number;
  trackName?: string;
  artistName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

const USER_AGENT = 'Lyrika/3.0 (https://github.com/yaluft/LiveLyricsRU)';

async function get(path: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.lyricsTimeoutMs);
  try {
    const response = await fetch(`${config.lrclibBaseUrl}${path}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    // A lyric provider being slow or down is routine, not exceptional — the
    // caller just moves on to the next source.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const CYRILLIC = /[Ѐ-ӿ]/;

/**
 * Rejects a hit whose lyrics carry no Cyrillic when the track itself clearly
 * does. LRCLIB matches loosely on title and artist, and a Latin-script cover or
 * an unrelated song with a similar name is a common false positive — showing
 * the wrong lyrics in perfect sync is worse than showing none.
 */
function scriptMismatch(record: LrclibRecord, title: string, artist: string): boolean {
  const wantsCyrillic = CYRILLIC.test(title) || CYRILLIC.test(artist);
  if (!wantsCyrillic) return false;

  const body = record.syncedLyrics ?? record.plainLyrics ?? '';
  return body !== '' && !CYRILLIC.test(body);
}

function pickBody(record: LrclibRecord): string | null {
  // Synced beats plain: the whole point is the timed view.
  return record.syncedLyrics?.trim() || record.plainLyrics?.trim() || null;
}

export async function fetchFromLrclib(
  title: string,
  artist: string,
  durationSec: number,
): Promise<LyricSourceResult | null> {
  if (!title) return null;

  if (artist) {
    const params = new URLSearchParams({ track_name: title, artist_name: artist });
    if (durationSec > 0) params.set('duration', String(Math.round(durationSec)));

    const exact = (await get(`/api/get?${params.toString()}`)) as LrclibRecord | null;
    if (exact && !exact.instrumental && !scriptMismatch(exact, title, artist)) {
      const body = pickBody(exact);
      if (body) return { sourceId: 'lrclib', raw: body };
    }
  }

  const search = (await get(
    `/api/search?${new URLSearchParams({ q: `${artist} ${title}`.trim() }).toString()}`,
  )) as LrclibRecord[] | null;

  if (!Array.isArray(search)) return null;

  for (const record of search) {
    if (record.instrumental) continue;
    if (scriptMismatch(record, title, artist)) continue;
    const body = pickBody(record);
    if (body) return { sourceId: 'lrclib', raw: body };
  }

  return null;
}
