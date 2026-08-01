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
  /** Serve the built client from the API process (single-container deploys). */
  serveClient: bool(process.env.SERVE_CLIENT, false),
  clientDir: resolve(process.env.CLIENT_DIR ?? '../client/dist'),
  dataDir: resolve(process.env.DATA_DIR ?? './.data'),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
} as const;
