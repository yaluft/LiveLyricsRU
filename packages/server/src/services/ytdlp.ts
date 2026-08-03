import { execFile } from 'node:child_process';
import { statSync } from 'node:fs';
import { promisify } from 'node:util';
import { trackId as makeTrackId, type StreamProvider, type Track } from '@lyrika/core';
import { config } from '../config.js';
import { checkMediaUrl } from './urlGuard.js';

const run = promisify(execFile);

/** 8 MB. A --dump-json can be large; unbounded output cannot be. */
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

export class ResolveFailed extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'ResolveFailed';
  }
}

export class ResolverUnavailable extends Error {
  constructor() {
    super('yt-dlp не установлен на сервере');
    this.name = 'ResolverUnavailable';
  }
}

let probe: Promise<boolean> | undefined;

/**
 * Whether `yt-dlp` is on PATH. Memoised — health checks hit this often and
 * spawning a process each time would be wasteful.
 *
 * Absence is a supported state, not an error: search and URL resolution become
 * unavailable, and upload remains a fully working path.
 */
export function ytDlpAvailable(): Promise<boolean> {
  probe ??= exec(['--version'])
    .then(() => true)
    .catch(() => false);
  return probe;
}

export function resetYtDlpProbe(): void {
  probe = undefined;
}

/**
 * A cookie file lets yt-dlp present a signed-in session when YouTube demands
 * one. The isFile() check matters specifically for Docker: bind-mounting a
 * host file that does not exist creates an empty *directory* at the target,
 * and handing yt-dlp a directory fails far downstream of the actual cause.
 */
export function resolvedCookiesPath(): string | null {
  if (!config.ytDlpCookiesPath) return null;
  try {
    return statSync(config.ytDlpCookiesPath).isFile() ? config.ytDlpCookiesPath : null;
  } catch {
    return null;
  }
}

/**
 * Builds the argv. Exported because the ordering here *is* the security
 * property: every caller-supplied value sits after `--`, so a query or URL
 * beginning with `-` can never be reinterpreted as an option.
 */
export function buildArgs(flags: string[], operands: string[]): string[] {
  const cookies = resolvedCookiesPath();
  return [
    ...flags,
    ...(cookies ? ['--cookies', cookies] : []),
    '--no-warnings',
    '--no-playlist',
    '--',
    ...operands,
  ];
}

/**
 * Runs yt-dlp via execFile with an argv array — never a shell, so no amount of
 * quoting, backticks or semicolons in a pasted URL can become a command. The
 * environment is reduced to PATH and HOME: the subprocess has no reason to
 * inherit API keys or anything else the server holds.
 */
async function exec(args: string[]): Promise<string> {
  const { stdout } = await run(config.ytDlpPath, args, {
    timeout: config.ytDlpTimeoutMs,
    maxBuffer: MAX_OUTPUT_BYTES,
    killSignal: 'SIGKILL',
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' },
  });
  return stdout;
}

interface YtDlpEntry {
  id?: string;
  title?: string;
  uploader?: string;
  channel?: string;
  artist?: string;
  album?: string;
  duration?: number;
  thumbnail?: string;
  thumbnails?: { url?: string }[];
  url?: string;
  ext?: string;
  extractor_key?: string;
}

function pickThumb(entry: YtDlpEntry): string | null {
  if (entry.thumbnail) return entry.thumbnail;
  return entry.thumbnails?.at(-1)?.url ?? null;
}

function providerOf(entry: YtDlpEntry, fallback: StreamProvider): StreamProvider {
  const key = entry.extractor_key?.toLowerCase() ?? '';
  if (key.includes('youtube')) return 'youtube';
  if (key.includes('vk')) return 'vk';
  return fallback;
}

function toTrack(entry: YtDlpEntry, fallbackProvider: StreamProvider): Track | null {
  const providerId = entry.id;
  if (!providerId) return null;

  const provider = providerOf(entry, fallbackProvider);
  return {
    id: makeTrackId(provider, providerId),
    provider,
    providerId,
    title: entry.title ?? providerId,
    artist: entry.artist ?? entry.uploader ?? entry.channel ?? '',
    album: entry.album ?? null,
    durationSec: Math.round(entry.duration ?? 0),
    thumbUrl: pickThumb(entry),
  };
}

function parseJsonLines(stdout: string): YtDlpEntry[] {
  const out: YtDlpEntry[] = [];
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as YtDlpEntry);
    } catch {
      // One malformed line should not discard the rest of the results.
    }
  }
  return out;
}

export async function searchTracks(query: string, limit = 8): Promise<Track[]> {
  if (!(await ytDlpAvailable())) throw new ResolverUnavailable();

  // `--flat-playlist` keeps this to one metadata request rather than resolving
  // a stream URL for every hit, which would be slow and almost entirely wasted.
  const args = buildArgs(
    ['--dump-json', '--flat-playlist', '--playlist-end', String(limit)],
    [`ytsearch${limit}:${query}`],
  );

  let stdout: string;
  try {
    stdout = await exec(args);
  } catch {
    throw new ResolveFailed('Не удалось выполнить поиск', 'Попробуйте вставить ссылку напрямую.');
  }

  return parseJsonLines(stdout)
    .map((entry) => toTrack(entry, 'youtube'))
    .filter((track): track is Track => track !== null);
}

/** Metadata for a pasted URL, once the guard has approved it. */
export async function resolveUrl(rawUrl: string): Promise<Track> {
  const check = checkMediaUrl(rawUrl);
  if (!check.ok) throw new ResolveFailed(check.reason, check.hint);
  if (!(await ytDlpAvailable())) throw new ResolverUnavailable();

  let stdout: string;
  try {
    stdout = await exec(buildArgs(['--dump-json'], [check.url]));
  } catch {
    throw new ResolveFailed('Не удалось разобрать ссылку', 'Проверьте, что видео доступно.');
  }

  const [entry] = parseJsonLines(stdout);
  const track = entry ? toTrack(entry, check.provider) : null;
  if (!track) throw new ResolveFailed('Источник не вернул данные о треке');

  return track;
}

export interface ResolvedStream {
  url: string;
  mimeType: string;
}

/**
 * The playable URL for a track. This value must never reach the browser: it is
 * IP-bound and CORS-less, so it only works from this process, and handing it
 * out would break playback *and* expose the resolver's address.
 */
export async function resolveStream(track: Track): Promise<ResolvedStream> {
  if (track.provider === 'upload') {
    throw new ResolveFailed('Загруженные файлы отдаются напрямую');
  }
  if (!(await ytDlpAvailable())) throw new ResolverUnavailable();

  const pageUrl =
    track.provider === 'youtube'
      ? `https://www.youtube.com/watch?v=${encodeURIComponent(track.providerId)}`
      : `https://vk.com/video${encodeURIComponent(track.providerId)}`;

  // Re-checked even though we built it ourselves: `providerId` may have come
  // from a client-supplied track id, and could otherwise smuggle in a path or
  // host that turns this into a request somewhere else entirely.
  const check = checkMediaUrl(pageUrl);
  if (!check.ok) throw new ResolveFailed(check.reason, check.hint);

  let stdout: string;
  try {
    stdout = await exec(
      buildArgs(['--dump-json', '-f', 'bestaudio[ext=m4a]/bestaudio/best'], [check.url]),
    );
  } catch {
    throw new ResolveFailed(
      'Источник недоступен',
      'YouTube мог потребовать вход — попробуйте загрузить файл.',
    );
  }

  const [entry] = parseJsonLines(stdout);
  if (!entry?.url) throw new ResolveFailed('Источник не отдал аудиопоток');

  return { url: entry.url, mimeType: entry.ext === 'webm' ? 'audio/webm' : 'audio/mp4' };
}
