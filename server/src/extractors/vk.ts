import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { TrackInfo } from '../types.js';

const execFileAsync = promisify(execFile);

interface YtDlpMeta {
  title?: string;
  uploader?: string;
  artist?: string;
  creator?: string;
  track?: string;
  thumbnail?: string;
  duration?: number;
}

function cleanUploader(raw: string): string {
  return raw.replace(/\s*-\s*Topic\s*$/i, '').trim();
}

async function ytdlpJson(url: string): Promise<YtDlpMeta> {
  const { stdout } = await execFileAsync('python3', [
    '-m', 'yt_dlp', '--dump-json', '--no-playlist', '--quiet', url,
  ], { timeout: 30_000 });
  return JSON.parse(stdout.trim()) as YtDlpMeta;
}

async function ytdlpGetUrl(url: string): Promise<string> {
  const { stdout } = await execFileAsync('python3', [
    '-m', 'yt_dlp', '--format', 'bestaudio/best', '--get-url',
    '--no-playlist', '--quiet', url,
  ], { timeout: 30_000 });
  const streamUrl = stdout.trim().split('\n')[0];
  if (!streamUrl) throw new Error('yt-dlp returned no URL for VK');
  return streamUrl;
}

export async function extractVk(url: string): Promise<TrackInfo> {
  const [meta, streamUrl] = await Promise.all([
    ytdlpJson(url),
    ytdlpGetUrl(url),
  ]);
  const artist = meta.artist ?? meta.creator
    ?? (meta.uploader ? cleanUploader(meta.uploader) : 'Unknown');
  const title = meta.track ?? meta.title ?? 'Unknown';
  return {
    streamUrl,
    title,
    artist,
    thumbnail: meta.thumbnail ?? '',
    durationSec: meta.duration ?? null,
    source: 'vk',
  };
}
