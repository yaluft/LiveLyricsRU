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
  /**
   * Musixmatch (unofficial desktop API) is the widest synced-lyrics source, used
   * as an extra fallback for songs LRCLIB doesn't have. It needs no paid key: an
   * anonymous user token is fetched and cached automatically. Supply your own via
   * MUSIXMATCH_USERTOKEN to skip the token endpoint, or set MUSIXMATCH_ENABLED=0
   * to turn the source off entirely.
   */
  musixmatchEnabled: bool(process.env.MUSIXMATCH_ENABLED, true),
  musixmatchBaseUrl: process.env.MUSIXMATCH_BASE_URL ?? 'https://apic-desktop.musixmatch.com',
  musixmatchUserToken: process.env.MUSIXMATCH_USERTOKEN ?? '',
  musixmatchTimeoutMs: num(process.env.MUSIXMATCH_TIMEOUT_MS, 8_000),
  /**
   * Google Gemini (free tier) powers line translation and the AI lyric
   * assistant. Both features degrade to their previous behaviour when the key
   * is absent, so an unset key is a supported configuration, not an error.
   */
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
  geminiBaseUrl: process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com',
  geminiTimeoutMs: num(process.env.GEMINI_TIMEOUT_MS, 15_000),
  /** ISO code the translation feature renders lyrics into. */
  translateTargetLang: process.env.TRANSLATE_TARGET_LANG ?? 'en',
  /** Serve the built client from the API process (single-container deploys). */
  serveClient: bool(process.env.SERVE_CLIENT, false),
  clientDir: resolve(process.env.CLIENT_DIR ?? '../client/dist'),
  dataDir: resolve(process.env.DATA_DIR ?? './.data'),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
} as const;
