import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { ResolvedStream, StreamProvider, Track } from '@lyrika/shared';
import { config } from '../config.js';
import { checkMediaUrl } from './urlGuard.js';

/**
 * yt-dlp is always spawned through execFile with an argv array — never a shell
 * string — and every caller-supplied value is placed after `--` so it can never
 * be read as an option. Nothing here interpolates input into a command line.
 */
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

class YtDlpUnavailable extends Error {
  constructor() {
    super('yt-dlp не установлен на сервере');
    this.name = 'YtDlpUnavailable';
  }
}

export class ResolveFailed extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = 'ResolveFailed';
    this.hint = hint;
  }
}

let availability: Promise<boolean> | null = null;

function buildArgs(baseArgs: string[]): string[] {
  const args = [...baseArgs];
  // Insert cookies flags before the final "--" separator (if present),
  // otherwise append them at the end. Placing them after a trailing `--`
  // would make yt-dlp treat them as download URLs.
  // Only add cookies flags when a cookies file actually exists in the app
  // data dir. Guarding prevents yt-dlp from attempting to write to a
  // non-existent path (which causes a FileNotFoundError inside yt-dlp).
  const cookiesPath = '/app/cookies.txt';
  if (existsSync(cookiesPath)) {
    const cookiesArgs = ['--cookies-from-browser', 'firefox', '--cookies', cookiesPath];
    const sepIndex = args.lastIndexOf('--');
    const insertAt = sepIndex >= 0 ? sepIndex : args.length;
    args.splice(insertAt, 0, ...cookiesArgs);
  }
  return args;
}

function run(args: string[]): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    execFile(
      config.ytDlpPath,
      buildArgs(args),
      {
        timeout: config.ytDlpTimeoutMs,
        maxBuffer: MAX_OUTPUT_BYTES,
        windowsHide: true,
        // No `shell` option: argv is passed to execve as-is.
        env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' },
      },
      (error, stdout, stderr) => {
        if (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code === 'ENOENT') {
            reject(new YtDlpUnavailable());
            return;
          }
          reject(new Error(stderr.trim() || error.message));
          return;
        }
        resolvePromise(stdout);
      },
    );
  });
}

export function ytDlpAvailable(): Promise<boolean> {
  availability ??= run(['--version'])
    .then(() => true)
    .catch(() => false);
  return availability;
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
  url?: string;
  abr?: number;
  ext?: string;
  webpage_url?: string;
}

function parseJsonLines(stdout: string): YtDlpEntry[] {
  const out: YtDlpEntry[] = [];
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as YtDlpEntry);
    } catch {
      // yt-dlp interleaves warnings on stdout in some versions; skip non-JSON.
    }
  }
  return out;
}

function toTrack(entry: YtDlpEntry, provider: StreamProvider): Track | null {
  const id = entry.id;
  if (!id) return null;
  return {
    id: `${provider}:${id}`,
    title: entry.title ?? 'Без названия',
    artist: entry.artist ?? entry.uploader ?? entry.channel ?? 'Неизвестный исполнитель',
    ...(entry.album !== undefined ? { album: entry.album } : {}),
    durationSec: Math.round(entry.duration ?? 0),
    provider,
    providerId: id,
    ...(entry.thumbnail !== undefined ? { artworkUrl: entry.thumbnail } : {}),
    hasSyncedLyrics: false,
  };
}

export async function searchTracks(query: string, limit = 8): Promise<Track[]> {
  if (!(await ytDlpAvailable())) throw new YtDlpUnavailable();
  const stdout = await run([
    '--dump-json',
    '--flat-playlist',
    '--no-warnings',
    '--no-playlist',
    '--playlist-end',
    String(limit),
    '--',
    `ytsearch${limit}:${query}`,
  ]);
  return parseJsonLines(stdout)
    .map((entry) => toTrack(entry, 'youtube'))
    .filter((t): t is Track => t !== null);
}

async function resolveViaYtDlp(
  url: string,
  provider: StreamProvider,
): Promise<{ track: Track; stream: ResolvedStream }> {
  if (!(await ytDlpAvailable())) throw new YtDlpUnavailable();

  const stdout = await run([
    '--dump-json',
    '--no-warnings',
    '--no-playlist',
    '-f',
    'bestaudio[ext=m4a]/bestaudio/best',
    '--',
    url,
  ]);
  const entry = parseJsonLines(stdout)[0];
  if (!entry?.url) {
    throw new ResolveFailed('Не удалось получить поток', 'Попробуйте другую ссылку.');
  }
  const track = toTrack(entry, provider);
  if (!track) throw new ResolveFailed('Ответ без идентификатора трека', 'Попробуйте ещё раз.');

  return {
    track,
    stream: {
      trackId: track.id,
      url: entry.url,
      mimeType: entry.ext === 'm4a' ? 'audio/mp4' : 'audio/webm',
      bitrateKbps: Math.round(entry.abr ?? 128),
      provider,
      expiresAt: null,
    },
  };
}

export async function resolveUrl(rawUrl: string): Promise<{ track: Track; stream: ResolvedStream }> {
  const check = checkMediaUrl(rawUrl);
  if (!check.ok) {
    throw new ResolveFailed(check.reason, 'Вставьте ссылку YouTube или VK.');
  }
  if (check.provider === 'spotify') {
    throw new ResolveFailed(
      'Spotify отдаёт только 30-секундные превью',
      'Попробуйте вариант с YouTube.',
    );
  }
  return resolveViaYtDlp(check.url, check.provider);
}

/** Loose sanity gate so a demo track doesn't silently resolve to an unrelated cover. */
function looksLikeMatch(candidate: Track, wanted: Track): boolean {
  const durationOk =
    wanted.durationSec === 0 || Math.abs(candidate.durationSec - wanted.durationSec) <= 15;
  const titleOk = candidate.title
    .toLowerCase()
    .includes(wanted.title.toLowerCase().slice(0, 8));
  return durationOk && titleOk;
}

function demoStream(trackId: string): ResolvedStream {
  return {
    trackId,
    url: '',
    mimeType: 'audio/mp4',
    bitrateKbps: 0,
    provider: 'demo',
    expiresAt: null,
  };
}

export async function resolveTrack(track: Track): Promise<ResolvedStream> {
  if (track.provider === 'demo') {
    // A demo track only ever reaches here when yt-dlp is unavailable or its
    // search already came up empty (see /api/search) — so an upgrade attempt
    // here would almost always throw YtDlpUnavailable. Play it on the virtual
    // clock instead of hard-failing; only try a real upgrade when yt-dlp is
    // actually usable, and still fall back to the demo stream if that fails.
    if (!(await ytDlpAvailable())) return demoStream(track.id);

    const query = `${track.artist} ${track.title}`.trim() || track.title;
    const candidates = await searchTracks(query, 3).catch(() => []);
    const match = candidates.find((c) => looksLikeMatch(c, track)) ?? candidates[0];
    if (!match) return demoStream(track.id);

    const url = `https://www.youtube.com/watch?v=${encodeURIComponent(match.providerId)}`;
    try {
      const { stream } = await resolveViaYtDlp(url, 'youtube');
      return { ...stream, trackId: track.id };
    } catch {
      return demoStream(track.id);
    }
  }
  const url =
    track.provider === 'youtube'
      ? `https://www.youtube.com/watch?v=${encodeURIComponent(track.providerId)}`
      : track.provider === 'vk'
        ? `https://vk.com/video${encodeURIComponent(track.providerId)}`
        : track.providerId;
  const { stream } = await resolveUrl(url);
  return { ...stream, trackId: track.id };
}

export { YtDlpUnavailable };
