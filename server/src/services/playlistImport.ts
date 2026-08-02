import type { Track } from '@lyrika/shared';
import { config } from '../config.js';
import { searchCatalog } from '../data/catalog.js';
import { checkMediaUrl } from './urlGuard.js';
import { fetchPlaylist, searchTracks, YtDlpUnavailable } from './ytdlp.js';

/**
 * Deezer and Spotify hand us metadata only — a title and an artist, never a
 * playable stream. Every such entry is re-matched against a provider that can
 * actually play (yt-dlp search, then the bundled catalogue), and anything that
 * does not match is reported honestly in `skipped` rather than faked.
 */
export class ImportUnavailable extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = 'ImportUnavailable';
    this.hint = hint;
  }
}

export interface ImportedSet {
  name: string;
  tracks: Track[];
  skipped: string[];
}

/** One metadata-only entry, before it is matched to something playable. */
interface Entry {
  artist: string;
  title: string;
  artworkUrl?: string;
}

const MATCH_CONCURRENCY = 4;
const MAX_ENTRIES = 200;

function label(entry: Entry): string {
  return entry.artist ? `${entry.artist} — ${entry.title}` : entry.title;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Loose gate so an import doesn't silently fill up with unrelated covers. */
function looksLikeMatch(candidate: Track, entry: Entry): boolean {
  const title = normalize(entry.title);
  if (!title) return false;
  const hay = normalize(`${candidate.title} ${candidate.artist}`);
  return hay.includes(title.slice(0, Math.min(title.length, 12)));
}

async function matchEntry(entry: Entry): Promise<Track | null> {
  const query = `${entry.artist} ${entry.title}`.trim();
  if (!query) return null;

  let match: Track | undefined;
  try {
    const candidates = await searchTracks(query, 3);
    // The search itself is query-driven, so the top hit is a fair fallback.
    match = candidates.find((c) => looksLikeMatch(c, entry)) ?? candidates[0];
  } catch (error) {
    if (!(error instanceof YtDlpUnavailable)) return null;
    // No resolver: the demo catalogue answers, but only on a real match — its
    // search deliberately returns filler rather than nothing.
    match = searchCatalog(query).find((c) => looksLikeMatch(c, entry));
  }

  if (!match) return null;
  return entry.artworkUrl && !match.artworkUrl
    ? { ...match, artworkUrl: entry.artworkUrl }
    : match;
}

/** Matches entries a few at a time so an import doesn't fan out into N subprocesses. */
async function matchAll(entries: Entry[]): Promise<{ tracks: Track[]; skipped: string[] }> {
  const capped = entries.slice(0, MAX_ENTRIES);
  const matched: (Track | null)[] = capped.map(() => null);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(MATCH_CONCURRENCY, capped.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      const entry = capped[index];
      if (!entry) break;
      matched[index] = await matchEntry(entry).catch(() => null);
    }
  });
  await Promise.all(workers);

  const tracks: Track[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  capped.forEach((entry, index) => {
    const track = matched[index];
    if (!track) {
      skipped.push(label(entry));
      return;
    }
    if (seen.has(track.id)) return;
    seen.add(track.id);
    tracks.push(track);
  });

  for (const entry of entries.slice(MAX_ENTRIES)) skipped.push(label(entry));
  return { tracks, skipped };
}

function guard(url: string, host: string, message: string, hint: string): URL {
  const check = checkMediaUrl(url);
  if (!check.ok || !(check.host === host || check.host.endsWith(`.${host}`))) {
    throw new ImportUnavailable(message, hint);
  }
  return new URL(check.url);
}

async function getJson(url: string, timeoutMs: number, headers: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json', ...headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------------ Deezer */

interface DeezerTrack {
  title?: string;
  artist?: { name?: string };
  album?: { cover_medium?: string };
}

interface DeezerPlaylist {
  title?: string;
  tracks?: { data?: DeezerTrack[] };
}

export async function importFromDeezer(url: string): Promise<ImportedSet> {
  const parsed = guard(
    url,
    'deezer.com',
    'Это не ссылка на плейлист Deezer',
    'Вставьте ссылку вида deezer.com/playlist/…',
  );
  const id = /\/playlist\/(\d+)/.exec(parsed.pathname)?.[1];
  if (!id) {
    throw new ImportUnavailable(
      'В ссылке нет идентификатора плейлиста',
      'Скопируйте ссылку на сам плейлист, а не на трек.',
    );
  }

  let data: DeezerPlaylist;
  try {
    data = (await getJson(
      `${config.deezerBaseUrl}/playlist/${id}`,
      config.deezerTimeoutMs,
      {},
    )) as DeezerPlaylist;
  } catch {
    throw new ImportUnavailable(
      'Deezer не ответил',
      'Проверьте, что плейлист публичный, и попробуйте ещё раз.',
    );
  }

  const items = Array.isArray(data.tracks?.data) ? data.tracks.data : [];
  const entries: Entry[] = [];
  const skipped: string[] = [];
  for (const item of items) {
    const title = item.title?.trim() ?? '';
    if (!title) continue;
    const cover = item.album?.cover_medium;
    entries.push({
      artist: item.artist?.name?.trim() ?? '',
      title,
      ...(cover ? { artworkUrl: cover } : {}),
    });
  }

  const result = await matchAll(entries);
  return {
    name: data.title?.trim() || 'Плейлист Deezer',
    tracks: result.tracks,
    skipped: [...skipped, ...result.skipped],
  };
}

/* ----------------------------------------------------------------- YouTube */

export async function importFromYoutube(url: string): Promise<ImportedSet> {
  try {
    const { title, tracks } = await fetchPlaylist(url);
    if (!tracks.length) {
      throw new ImportUnavailable(
        'В плейлисте нет доступных видео',
        'Проверьте, что плейлист публичный.',
      );
    }
    return { name: title, tracks, skipped: [] };
  } catch (error) {
    if (error instanceof ImportUnavailable) throw error;
    if (error instanceof YtDlpUnavailable) {
      throw new ImportUnavailable(
        'Импорт из YouTube недоступен: на сервере нет yt-dlp',
        'Импортируйте список строками «Исполнитель — Название».',
      );
    }
    throw new ImportUnavailable(
      'Не удалось прочитать плейлист YouTube',
      'Проверьте ссылку и попробуйте ещё раз.',
    );
  }
}

/* ----------------------------------------------------------------- Spotify */

interface SpotifyPlaylist {
  name?: string;
  tracks?: {
    items?: {
      track?: {
        name?: string;
        artists?: { name?: string }[];
        album?: { images?: { url?: string }[] };
      } | null;
    }[];
  };
}

async function spotifyToken(): Promise<string> {
  const basic = Buffer.from(`${config.spotifyClientId}:${config.spotifyClientSecret}`).toString(
    'base64',
  );
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    signal: AbortSignal.timeout(config.deezerTimeoutMs),
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    throw new ImportUnavailable(
      'Spotify не принял ключи приложения',
      'Проверьте SPOTIFY_CLIENT_ID и SPOTIFY_CLIENT_SECRET.',
    );
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new ImportUnavailable(
      'Spotify не выдал токен',
      'Проверьте SPOTIFY_CLIENT_ID и SPOTIFY_CLIENT_SECRET.',
    );
  }
  return data.access_token;
}

export async function importFromSpotify(url: string): Promise<ImportedSet> {
  if (!config.spotifyClientId || !config.spotifyClientSecret) {
    throw new ImportUnavailable(
      'Импорт из Spotify не настроен',
      'Задайте SPOTIFY_CLIENT_ID и SPOTIFY_CLIENT_SECRET на сервере.',
    );
  }

  const parsed = guard(
    url,
    'spotify.com',
    'Это не ссылка на плейлист Spotify',
    'Вставьте ссылку вида open.spotify.com/playlist/…',
  );
  const id = /\/playlist\/([A-Za-z0-9]+)/.exec(parsed.pathname)?.[1];
  if (!id) {
    throw new ImportUnavailable(
      'В ссылке нет идентификатора плейлиста',
      'Скопируйте ссылку на сам плейлист, а не на трек.',
    );
  }

  const token = await spotifyToken();
  let data: SpotifyPlaylist;
  try {
    data = (await getJson(
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(id)}`,
      config.deezerTimeoutMs,
      { Authorization: `Bearer ${token}` },
    )) as SpotifyPlaylist;
  } catch {
    throw new ImportUnavailable(
      'Spotify не отдал плейлист',
      'Проверьте, что плейлист публичный, и попробуйте ещё раз.',
    );
  }

  const entries: Entry[] = [];
  for (const item of data.tracks?.items ?? []) {
    const track = item.track;
    const title = track?.name?.trim() ?? '';
    if (!title) continue;
    const cover = track?.album?.images?.[0]?.url;
    entries.push({
      artist: track?.artists?.[0]?.name?.trim() ?? '',
      title,
      ...(cover ? { artworkUrl: cover } : {}),
    });
  }

  const result = await matchAll(entries);
  return { name: data.name?.trim() || 'Плейлист Spotify', ...result };
}

/* -------------------------------------------------------------------- Text */

const SEPARATORS = /\s+[—–-]\s+|\t|,/;

function parseTextEntries(body: string): { entries: Entry[]; skipped: string[] } {
  const entries: Entry[] = [];
  const skipped: string[] = [];

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(SEPARATORS).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) {
      skipped.push(line);
      continue;
    }
    const [artist, title] = parts;
    if (!artist || !title) {
      skipped.push(line);
      continue;
    }
    entries.push({ artist, title });
  }

  return { entries, skipped };
}

interface ExportedTrack {
  title?: unknown;
  artist?: unknown;
  artworkUrl?: unknown;
}

function parseJsonEntries(body: string): { entries: Entry[]; skipped: string[] } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const entries: Entry[] = [];
  const skipped: string[] = [];
  for (const item of parsed as ExportedTrack[]) {
    const title = typeof item?.title === 'string' ? item.title.trim() : '';
    if (!title) {
      skipped.push(JSON.stringify(item));
      continue;
    }
    const artwork = typeof item.artworkUrl === 'string' ? item.artworkUrl : '';
    entries.push({
      artist: typeof item.artist === 'string' ? item.artist.trim() : '',
      title,
      ...(artwork ? { artworkUrl: artwork } : {}),
    });
  }
  return { entries, skipped };
}

/**
 * Pasted lists resolve lazily instead of running a search per line: each entry
 * becomes a `demo:`-provider track, which `resolveTrack` already resolves by
 * searching for "artist title" at playback time. That keeps the import instant
 * and avoids spawning a subprocess per pasted line. Only unparseable lines are
 * reported as skipped.
 */
export function importFromText(body: string): ImportedSet {
  const trimmed = body.trim();
  const parsed = parseJsonEntries(trimmed) ?? parseTextEntries(trimmed);
  const seen = new Set<string>();
  const tracks: Track[] = [];

  for (const entry of parsed.entries.slice(0, MAX_ENTRIES)) {
    const id = `demo:${normalize(label(entry)).replace(/\s+/g, '-')}`;
    if (seen.has(id)) continue;
    seen.add(id);
    tracks.push({
      id,
      title: entry.title,
      artist: entry.artist,
      durationSec: 0,
      provider: 'demo',
      providerId: id.slice('demo:'.length),
      ...(entry.artworkUrl ? { artworkUrl: entry.artworkUrl } : {}),
      hasSyncedLyrics: false,
    });
  }

  const skipped = [...parsed.skipped, ...parsed.entries.slice(MAX_ENTRIES).map(label)];
  return { name: 'Импортированный список', tracks, skipped };
}
