import { resolve } from 'node:path';

function num(value: string | undefined, fallback: number): number {
  const n = value ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

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
  dataDir: resolve(process.env.DATA_DIR ?? './.data'),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  /**
   * Every AI feature (EN translation, lyric drafting, line explanation) needs
   * this key. Absent, the assistant degrades to the local placeholder and the
   * rest of the app is unaffected — same contract as a missing yt-dlp.
   */
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5',
  anthropicEffort: process.env.ANTHROPIC_EFFORT ?? 'medium',
  anthropicTimeoutMs: num(process.env.ANTHROPIC_TIMEOUT_MS, 60_000),
  /** Keyless for public playlists. */
  deezerBaseUrl: process.env.DEEZER_BASE_URL ?? 'https://api.deezer.com',
  deezerTimeoutMs: num(process.env.DEEZER_TIMEOUT_MS, 8_000),
  /** Spotify import is metadata-only and stays disabled until both are set. */
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID ?? '',
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? '',
} as const;
