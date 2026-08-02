import Redis from 'ioredis';
import type { ResolvedStream } from '@lyrika/shared';
import { config } from '../config.js';

/**
 * yt-dlp hands back a direct googlevideo/VK CDN URL, but those are commonly
 * bound to the IP that requested them and carry no CORS headers, so a browser
 * fetching them straight from the client fails unpredictably. Every stream is
 * proxied through this server instead: the client always gets a same-origin
 * `/api/stream/:trackId` URL, and the real CDN URL is cached briefly here so
 * repeat range requests (seeking) don't re-invoke yt-dlp each time.
 *
 * The cache itself is pluggable: Redis when `REDIS_URL` is configured (so a
 * multi-instance deploy shares one cache), otherwise an in-memory `Map`
 * (today's behaviour) so the app keeps working with zero new required
 * infrastructure — the same "degrade gracefully" posture as yt-dlp/LRCLIB
 * elsewhere in this codebase.
 */
export const STREAM_CACHE_TTL_MS = 5 * 60 * 1000;

export interface StreamCacheEntry {
  url: string;
  mimeType: string;
  expiresAt: number;
}

interface StreamCacheBackend {
  get(trackId: string): Promise<StreamCacheEntry | null>;
  set(trackId: string, entry: StreamCacheEntry): Promise<void>;
  delete(trackId: string): Promise<void>;
}

// Coalesces concurrent range requests for the same cold trackId so a media
// element's simultaneous buffering requests don't spawn duplicate yt-dlp
// runs. This is a local, per-process optimization orthogonal to cross-instance
// cache sharing — it stays in-memory unconditionally, regardless of which
// StreamCacheBackend is selected below. Distributing it would need
// distributed locking for no real benefit.
export const STREAM_INFLIGHT = new Map<string, Promise<ResolvedStream>>();

class MemoryStreamCacheBackend implements StreamCacheBackend {
  private readonly map = new Map<string, StreamCacheEntry>();

  constructor() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.map) {
        if (entry.expiresAt < now) this.map.delete(key);
      }
    }, STREAM_CACHE_TTL_MS).unref();
  }

  async get(trackId: string): Promise<StreamCacheEntry | null> {
    const entry = this.map.get(trackId);
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry;
  }

  async set(trackId: string, entry: StreamCacheEntry): Promise<void> {
    this.map.set(trackId, entry);
  }

  async delete(trackId: string): Promise<void> {
    this.map.delete(trackId);
  }
}

class RedisStreamCacheBackend implements StreamCacheBackend {
  private readonly client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
    });
    // Never let a connection error crash the process — a Redis outage should
    // degrade to cache misses, same "never hard-fail" posture as yt-dlp and
    // JsonStore elsewhere in this codebase.
    this.client.on('error', (error) => {
      console.warn('[streamCache] redis connection error:', (error as Error).message);
    });
  }

  private key(trackId: string): string {
    return `lyrika:stream:${trackId}`;
  }

  async get(trackId: string): Promise<StreamCacheEntry | null> {
    try {
      const raw = await this.client.get(this.key(trackId));
      if (!raw) return null;
      return JSON.parse(raw) as StreamCacheEntry;
    } catch (error) {
      console.warn('[streamCache] redis get failed, treating as cache miss:', (error as Error).message);
      return null;
    }
  }

  async set(trackId: string, entry: StreamCacheEntry): Promise<void> {
    try {
      const ttlMs = Math.max(1, entry.expiresAt - Date.now());
      await this.client.set(this.key(trackId), JSON.stringify(entry), 'PX', ttlMs);
    } catch (error) {
      console.warn('[streamCache] redis set failed:', (error as Error).message);
    }
  }

  async delete(trackId: string): Promise<void> {
    try {
      await this.client.del(this.key(trackId));
    } catch (error) {
      console.warn('[streamCache] redis delete failed:', (error as Error).message);
    }
  }
}

function selectBackend(): StreamCacheBackend {
  if (!config.redisUrl) {
    console.info(
      '[streamCache] REDIS_URL not set — using per-process stream cache; multi-instance deploys need Redis for a shared cache',
    );
    return new MemoryStreamCacheBackend();
  }
  try {
    return new RedisStreamCacheBackend(config.redisUrl);
  } catch (error) {
    console.warn(
      '[streamCache] failed to initialise Redis backend, falling back to per-process cache:',
      (error as Error).message,
    );
    return new MemoryStreamCacheBackend();
  }
}

const backend: StreamCacheBackend = selectBackend();

export function getCachedStream(trackId: string): Promise<StreamCacheEntry | null> {
  return backend.get(trackId);
}

export function cacheStream(trackId: string, url: string, mimeType: string): Promise<void> {
  return backend.set(trackId, { url, mimeType, expiresAt: Date.now() + STREAM_CACHE_TTL_MS });
}

export function evictCachedStream(trackId: string): Promise<void> {
  return backend.delete(trackId);
}

export function proxyStreamUrl(trackId: string): string {
  return `/api/stream/${encodeURIComponent(trackId)}`;
}
