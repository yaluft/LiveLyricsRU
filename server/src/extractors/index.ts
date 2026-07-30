import type { TrackInfo } from '../types.js';
import { extractYoutube } from './youtube.js';
import { extractVk } from './vk.js';
import { extractSpotify } from './spotify.js';

export type Platform = 'youtube' | 'vk' | 'spotify' | 'direct';

export function detectPlatform(url: string): Platform {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/vk\.com/.test(url)) return 'vk';
  if (/spotify\.com/.test(url)) return 'spotify';
  return 'direct';
}

export async function extract(url: string): Promise<TrackInfo> {
  const platform = detectPlatform(url);
  switch (platform) {
    case 'youtube':
      return extractYoutube(url);
    case 'vk':
      return extractVk(url);
    case 'spotify':
      return extractSpotify(url);
    case 'direct':
      // Direct URL — return it as-is, no metadata extraction
      return {
        streamUrl: url,
        title: decodeURIComponent(url.split('/').pop() ?? 'Track').replace(/\.[^.]+$/, ''),
        artist: '',
        thumbnail: '',
        durationSec: null,
        source: 'direct',
      };
  }
}

export type { TrackInfo } from '../types.js';
