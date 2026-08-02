import { resolve, join } from 'node:path';

function num(value: string | undefined, fallback: number): number {
  const n = value ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

const dataDir = resolve(process.env.DATA_DIR ?? './.data');

export const config = {
  port: num(process.env.PORT, 8787),
  host: process.env.HOST ?? '0.0.0.0',
  /** Absolute path to the yt-dlp binary. Resolution is skipped when missing. */
  ytDlpPath: process.env.YT_DLP_PATH ?? 'yt-dlp',
  ytDlpTimeoutMs: num(process.env.YT_DLP_TIMEOUT_MS, 20_000),
  lrclibBaseUrl: process.env.LRCLIB_BASE_URL ?? 'https://lrclib.net',
  lrclibTimeoutMs: num(process.env.LRCLIB_TIMEOUT_MS, 6_000),
  /** Unofficial NetEase Cloud Music web API, used as a fallback lyrics source. */
  neteaseBaseUrl: process.env.NETEASE_BASE_URL ?? 'https://music.163.com',
  neteaseTimeoutMs: num(process.env.NETEASE_TIMEOUT_MS, 6_000),
  /** Serve the built client from the API process (single-container deploys). */
  serveClient: bool(process.env.SERVE_CLIENT, false),
  clientDir: resolve(process.env.CLIENT_DIR ?? '../client/dist'),
  dataDir,
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  sqlitePath: process.env.SQLITE_PATH ?? join(dataDir, 'lyrika.db'),
  /** Real hit TTL: a self-healing safety valve, not because lyrics go stale. */
  lyricsCacheTtlMs: num(process.env.LYRICS_CACHE_TTL_MS, 30 * 24 * 60 * 60 * 1000),
  /** Negative/tombstone TTL: bounds how often a genuinely-missing track re-hits LRCLIB/NetEase live. */
  lyricsNotFoundTtlMs: num(process.env.LYRICS_NOT_FOUND_TTL_MS, 60 * 60 * 1000),
} as const;
