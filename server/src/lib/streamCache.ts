import type { ResolvedStream } from '@lyrika/shared';

/**
 * yt-dlp hands back a direct googlevideo/VK CDN URL, but those are commonly
 * bound to the IP that requested them and carry no CORS headers, so a browser
 * fetching them straight from the client fails unpredictably. Every stream is
 * proxied through this server instead: the client always gets a same-origin
 * `/api/stream/:trackId` URL, and the real CDN URL is cached briefly here so
 * repeat range requests (seeking) don't re-invoke yt-dlp each time.
 */
export const STREAM_CACHE_TTL_MS = 5 * 60 * 1000;
export const STREAM_CACHE = new Map<string, { url: string; mimeType: string; expiresAt: number }>();
// Coalesces concurrent range requests for the same cold trackId so a media
// element's simultaneous buffering requests don't spawn duplicate yt-dlp runs.
export const STREAM_INFLIGHT = new Map<string, Promise<ResolvedStream>>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of STREAM_CACHE) {
    if (entry.expiresAt < now) STREAM_CACHE.delete(key);
  }
}, STREAM_CACHE_TTL_MS).unref();

export function cacheStream(trackId: string, url: string, mimeType: string): void {
  STREAM_CACHE.set(trackId, { url, mimeType, expiresAt: Date.now() + STREAM_CACHE_TTL_MS });
}

export function proxyStreamUrl(trackId: string): string {
  return `/api/stream/${encodeURIComponent(trackId)}`;
}
