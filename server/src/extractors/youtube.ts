import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { TrackInfo } from '../types.js';

const execFileAsync = promisify(execFile);

// Find yt-dlp binary — support pip user install and system install
const YTDLP = (() => {
  const candidates = [
    process.env.YTDLP_PATH,
    `${process.env.HOME}/.local/bin/yt-dlp`,
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
  ].filter(Boolean) as string[];
  return candidates[0]; // resolved lazily at call time
})();

interface YtDlpMeta {
  title?: string;
  uploader?: string;
  uploader_id?: string;
  artist?: string;
  creator?: string;
  track?: string;
  thumbnail?: string;
  duration?: number;
  url?: string;
}

/** Strip YouTube auto-generated " - Topic" suffix from uploader names */
function cleanUploader(raw: string): string {
  return raw.replace(/\s*-\s*Topic\s*$/i, '').trim();
}

async function ytdlpJson(url: string): Promise<YtDlpMeta> {
  const { stdout } = await execFileAsync('python3', [
    '-m', 'yt_dlp', '--dump-json', '--no-playlist',
    '--quiet', url,
  ], { timeout: 30_000 });
  return JSON.parse(stdout.trim()) as YtDlpMeta;
}

async function ytdlpGetUrl(url: string): Promise<string> {
  const { stdout } = await execFileAsync('python3', [
    '-m', 'yt_dlp',
    '--format', 'bestaudio/best',
    '--get-url',
    '--no-playlist',
    '--quiet',
    url,
  ], { timeout: 30_000 });
  const lines = stdout.trim().split('\n').filter(Boolean);
  const streamUrl = lines[0];
  if (!streamUrl) throw new Error('yt-dlp returned no URL');
  return streamUrl;
}

export async function extractYoutube(url: string): Promise<TrackInfo> {
  const [meta, streamUrl] = await Promise.all([
    ytdlpJson(url),
    ytdlpGetUrl(url),
  ]);
  // Prefer dedicated music fields; fall back to cleaned uploader
  const artist = meta.artist ?? meta.creator
    ?? (meta.uploader ? cleanUploader(meta.uploader) : 'Unknown');
  // Prefer dedicated track field over full video title
  const title = meta.track ?? meta.title ?? 'Unknown';
  return {
    streamUrl,
    title,
    artist,
    thumbnail: meta.thumbnail ?? '',
    durationSec: meta.duration ?? null,
    source: 'youtube',
  };
}
