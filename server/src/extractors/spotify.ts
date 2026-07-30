import fetch from 'node-fetch';
import type { TrackInfo } from '../types.js';

interface SpotifyOembed {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

function extractTrackId(url: string): string | null {
  const m = url.match(/spotify\.com\/track\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

async function getPreviewUrl(trackId: string): Promise<string | null> {
  // Fetch the open.spotify.com track page and parse og:audio meta tag
  const resp = await fetch(`https://open.spotify.com/track/${trackId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; lyrics-app/1.0)' },
  });
  if (!resp.ok) return null;
  const html = await resp.text();
  const match = html.match(/<meta[^>]+property="og:audio"[^>]+content="([^"]+)"/i)
    ?? html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:audio"/i);
  return match ? match[1] : null;
}

async function getOembed(url: string): Promise<SpotifyOembed> {
  const resp = await fetch(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; lyrics-app/1.0)' } }
  );
  if (!resp.ok) return {};
  return (await resp.json()) as SpotifyOembed;
}

export async function extractSpotify(url: string): Promise<TrackInfo> {
  const trackId = extractTrackId(url);
  if (!trackId) throw new Error('Invalid Spotify track URL');

  const [oembed, previewUrl] = await Promise.all([
    getOembed(url),
    getPreviewUrl(trackId),
  ]);

  if (!previewUrl) {
    throw new Error('Could not find Spotify preview URL (track may not have a 30s preview)');
  }

  // Title from oembed is usually "Song - Artist", split it
  const rawTitle = oembed.title ?? 'Unknown';
  const dashIdx = rawTitle.lastIndexOf(' - ');
  const title = dashIdx > 0 ? rawTitle.slice(0, dashIdx) : rawTitle;
  const artist = dashIdx > 0 ? rawTitle.slice(dashIdx + 3) : (oembed.author_name ?? 'Unknown');

  return {
    streamUrl: previewUrl,
    title,
    artist,
    thumbnail: oembed.thumbnail_url ?? '',
    durationSec: 30,
    source: 'spotify',
  };
}
