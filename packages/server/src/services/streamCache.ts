import type { Track } from '@lyrika/core';
import { resolveStream, type ResolvedStream } from './ytdlp.js';

const TTL_MS = 5 * 60 * 1000;

interface Entry extends ResolvedStream {
  expiresAt: number;
}

const CACHE = new Map<string, Entry>();

/**
 * Coalesces concurrent resolutions of the same cold track.
 *
 * A media element opens several parallel range requests as soon as it starts
 * buffering. Without this, each one finds an empty cache and spawns its own
 * yt-dlp process — several seconds of CPU each, all producing the same URL, and
 * a real risk of being rate-limited for the burst.
 */
const INFLIGHT = new Map<string, Promise<ResolvedStream>>();

const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of CACHE) {
    if (entry.expiresAt < now) CACHE.delete(key);
  }
}, TTL_MS);
// Never hold the process open just to sweep a cache.
sweeper.unref();

export function peekStream(trackId: string): ResolvedStream | null {
  const entry = CACHE.get(trackId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    CACHE.delete(trackId);
    return null;
  }
  return { url: entry.url, mimeType: entry.mimeType };
}

export function cacheStream(trackId: string, stream: ResolvedStream): void {
  CACHE.set(trackId, { ...stream, expiresAt: Date.now() + TTL_MS });
}

/**
 * Drops a cached URL that upstream has rejected.
 *
 * Call this for 403/404/410 — those mean the URL itself went stale (expired
 * signature, or bound to an address we no longer present from), so the next
 * request must re-resolve rather than replay a dead URL.
 *
 * Do NOT call it for 416. That means only the requested *range* was bad; the
 * URL is still good, and evicting would turn one bad seek into a full re-resolve.
 */
export function evictStream(trackId: string): void {
  CACHE.delete(trackId);
}

export function shouldEvictOn(status: number): boolean {
  return status === 403 || status === 404 || status === 410;
}

export async function getStream(track: Track): Promise<ResolvedStream> {
  const cached = peekStream(track.id);
  if (cached) return cached;

  const pending = INFLIGHT.get(track.id);
  if (pending) return pending;

  const promise = resolveStream(track)
    .then((stream) => {
      cacheStream(track.id, stream);
      return stream;
    })
    .finally(() => INFLIGHT.delete(track.id));

  INFLIGHT.set(track.id, promise);
  return promise;
}

/** Test seam. */
export function clearStreamCache(): void {
  CACHE.clear();
  INFLIGHT.clear();
}
