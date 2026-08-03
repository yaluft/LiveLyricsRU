import { resolve } from 'node:path';

function str(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function num(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

const dataDir = resolve(process.cwd(), str('DATA_DIR', './.data'));

export const config = {
  port: num('PORT', 8787),
  host: str('HOST', '0.0.0.0'),
  logLevel: str('LOG_LEVEL', 'info'),
  corsOrigin: str('CORS_ORIGIN', 'http://localhost:5173'),

  dataDir,
  databaseUrl: str('DATABASE_URL', `file:${resolve(dataDir, 'lyrika.db')}`),
  /** Read-only, built by `tools/build-dictionary`. Absent is a supported state. */
  dictionaryPath: str('DICTIONARY_PATH', resolve(dataDir, 'dictionary.db')),
  uploadsDir: resolve(dataDir, 'uploads'),
  maxUploadBytes: num('MAX_UPLOAD_BYTES', 64 * 1024 * 1024),

  ytDlpPath: str('YT_DLP_PATH', 'yt-dlp'),
  ytDlpTimeoutMs: num('YT_DLP_TIMEOUT_MS', 20_000),
  ytDlpCookiesPath: str('YT_DLP_COOKIES', ''),

  lrclibBaseUrl: str('LRCLIB_BASE_URL', 'https://lrclib.net'),
  lyricsTimeoutMs: num('LYRICS_TIMEOUT_MS', 6_000),

  /** Absent key is a supported state: the UI hides translations rather than erroring. */
  anthropicApiKey: str('ANTHROPIC_API_KEY', ''),
  translationModel: str('TRANSLATION_MODEL', 'claude-sonnet-5'),

  serveClient: bool('SERVE_CLIENT', false),
  clientDir: str('CLIENT_DIR', '../web/dist'),
} as const;

export type Config = typeof config;
