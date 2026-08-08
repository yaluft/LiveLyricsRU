import type { Lyrics, LyricLine, LyricWord, Track } from '@lyrika/shared';
import { config } from '../config.js';
import { parseLrc, plainToLyricLines, toLyricLines } from '../lib/lrc.js';
import { splitWords, transliterate } from '../lib/transliterate.js';

/**
 * Musixmatch's unofficial desktop-app API — the widest synced-lyrics database,
 * used as an extra fallback for tracks LRCLIB doesn't have. No paid key: an
 * anonymous `user_token` is fetched from the token endpoint and cached, exactly
 * as the community tools (syncedlyrics, Lyrix) do. Every failure returns null so
 * the lyrics route just falls through to the next source, same as the others.
 *
 * The response-shredding helpers are pure and exported for unit testing — the
 * macro responses are deeply nested and their shape is the fragile part.
 */
const APP_ID = 'web-desktop-app-v1.0';
const TOKEN_TTL_MS = 9 * 60 * 1000;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

let cachedToken: { value: string; expiresAt: number } | null = null;

/** Safe nested lookup, tolerant of any missing link in a macro response. */
function pick(obj: unknown, path: (string | number)[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

/** Reads the user token from a token.get response, rejecting the upgrade stub. */
export function extractToken(json: unknown): string | null {
  if (pick(json, ['message', 'header', 'status_code']) !== 200) return null;
  const token = pick(json, ['message', 'body', 'user_token']);
  if (typeof token !== 'string' || token.length < 8) return null;
  // Musixmatch hands back this sentinel when it wants you to upgrade — unusable.
  if (token.startsWith('UpgradeOnly')) return null;
  return token;
}

/** Pulls the LRC subtitle body out of a macro.subtitles.get response. */
export function extractSubtitle(json: unknown): string | null {
  const body = pick(json, [
    'message', 'body', 'macro_calls', 'track.subtitles.get',
    'message', 'body', 'subtitle_list', 0, 'subtitle', 'subtitle_body',
  ]);
  return typeof body === 'string' && body.trim() ? body : null;
}

/** Pulls the plain (unsynced) lyric body out of a macro response, if present. */
export function extractPlainLyrics(json: unknown): string | null {
  const body = pick(json, [
    'message', 'body', 'macro_calls', 'track.lyrics.get',
    'message', 'body', 'lyrics', 'lyrics_body',
  ]);
  return typeof body === 'string' && body.trim() ? body : null;
}

/**
 * Pulls the word-level "richsync" payload out of a macro.subtitles.get response
 * (present only when the request adds `optional_calls=track.richsync` and the
 * track has richsync data). `richsync_body` is itself a JSON string — an array
 * of `{ ts, te, x, l: [{ c, o }] }` lines, where `ts`/`te` are the line's
 * absolute start/end in seconds, `x` is the full line text, and each `l` entry
 * is a word chunk `c` with `o`, its offset in seconds from `ts`. Real per-word
 * timing, unlike the even-split guess `toLyricLines` falls back to.
 */
export function extractRichsync(json: unknown): unknown[] | null {
  const body = pick(json, [
    'message', 'body', 'macro_calls', 'track.richsync.get',
    'message', 'body', 'richsync', 'richsync_body',
  ]);
  if (typeof body !== 'string' || !body.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || !parsed.length) return null;
  return parsed as unknown[];
}

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Converts richsync entries into the app's line model using real sung timing.
 * Word offsets come straight from richsync's `l` chunks when their count lines
 * up 1:1 with our own tokenizer; otherwise that one line falls back to the
 * even-split guess so a chunk-grouping mismatch can't misalign the highlight
 * (and tap-to-define still sees single clean words either way).
 */
export function richsyncToLyricLines(entries: unknown[], totalDurationSec: number): LyricLine[] {
  const parsed = entries
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((obj) => ({ obj, time: toFiniteNumber(obj.ts) }))
    .filter((e): e is { obj: Record<string, unknown>; time: number } => e.time !== null)
    .sort((a, b) => a.time - b.time);

  const lines: LyricLine[] = [];
  parsed.forEach(({ obj, time }, i) => {
    const text = typeof obj.x === 'string' ? obj.x.trim() : '';
    if (!text) return;

    const next = parsed[i + 1];
    const teRaw = toFiniteNumber(obj.te);
    const end =
      teRaw !== null && teRaw > time
        ? teRaw
        : next && next.time > time
          ? next.time
          : Math.max(time + 4, totalDurationSec);

    const chunks = Array.isArray(obj.l) ? (obj.l as unknown[]) : [];
    const timedChunks: { offset: number }[] = [];
    for (const chunk of chunks) {
      if (!chunk || typeof chunk !== 'object') continue;
      const c = (chunk as Record<string, unknown>).c;
      if (typeof c !== 'string' || !c.trim()) continue; // pure-whitespace separator
      const offset = toFiniteNumber((chunk as Record<string, unknown>).o);
      timedChunks.push({ offset: offset !== null ? Math.max(offset, 0) : 0 });
    }

    const tokens = splitWords(text);
    const words: LyricWord[] =
      tokens.length && tokens.length === timedChunks.length
        ? tokens.map((tok, wi) => ({
            text: tok.text,
            translit: transliterate(tok.text),
            offset: timedChunks[wi]?.offset ?? 0,
          }))
        : tokens.map((tok, wi) => ({
            text: tok.text,
            translit: transliterate(tok.text),
            offset: tokens.length > 1 ? ((end - time) * wi) / tokens.length : 0,
          }));

    lines.push({
      id: `l${lines.length}`,
      time,
      end,
      text,
      translit: transliterate(text),
      translation: '',
      words,
    });
  });
  return lines;
}

const CYRILLIC_RE = /[Ѐ-ӿ]/;

/** A Cyrillic track whose lyrics come back in Latin is the wrong match. */
function scriptMismatch(lyricsText: string, track: Track): boolean {
  const targetIsCyrillic = CYRILLIC_RE.test(track.title) || CYRILLIC_RE.test(track.artist);
  return targetIsCyrillic && !CYRILLIC_RE.test(lyricsText);
}

async function getJson(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(path, config.musixmatchBaseUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    signal: AbortSignal.timeout(config.musixmatchTimeoutMs),
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`Musixmatch ${res.status}`);
  return res.json();
}

async function getToken(): Promise<string | null> {
  if (config.musixmatchUserToken) return config.musixmatchUserToken;
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const json = await getJson('/ws/1.1/token.get', { app_id: APP_ID, format: 'json' }).catch(
    () => null,
  );
  const token = json ? extractToken(json) : null;
  if (token) cachedToken = { value: token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return token;
}

export function musixmatchEnabled(): boolean {
  return config.musixmatchEnabled;
}

export async function fetchLyrics(track: Track): Promise<Lyrics | null> {
  if (!config.musixmatchEnabled) return null;
  if (!track.title.trim() || !track.artist.trim()) return null;

  const token = await getToken();
  if (!token) return null;

  const params: Record<string, string> = {
    format: 'json',
    namespace: 'lyrics_richsynched',
    subtitle_format: 'lrc',
    optional_calls: 'track.richsync',
    app_id: APP_ID,
    usertoken: token,
    q_track: track.title,
    q_artist: track.artist,
  };
  if (track.durationSec) params.q_duration = String(track.durationSec);

  const json = await getJson('/ws/1.1/macro.subtitles.get', params).catch(() => null);
  if (!json) return null;

  const richsync = extractRichsync(json);
  if (richsync) {
    const lines = richsyncToLyricLines(richsync, track.durationSec || 240);
    if (lines.length && !scriptMismatch(lines.map((l) => l.text).join(' '), track)) {
      return {
        trackId: track.id,
        kind: 'synced',
        source: 'musixmatch',
        sourceLabel: 'Musixmatch (по словам)',
        lines,
      };
    }
  }

  const lrc = extractSubtitle(json);
  if (lrc && !scriptMismatch(lrc, track)) {
    const lines = toLyricLines(parseLrc(lrc), track.durationSec || 240);
    if (lines.length) {
      return {
        trackId: track.id,
        kind: 'synced',
        source: 'musixmatch',
        sourceLabel: 'Musixmatch (синхро)',
        lines,
      };
    }
  }

  const plain = extractPlainLyrics(json);
  if (plain && !scriptMismatch(plain, track)) {
    const lines = plainToLyricLines(plain, track.durationSec || 240);
    if (lines.length) {
      return {
        trackId: track.id,
        kind: 'plain',
        source: 'musixmatch',
        sourceLabel: 'Musixmatch (только текст)',
        lines,
      };
    }
  }
  return null;
}
