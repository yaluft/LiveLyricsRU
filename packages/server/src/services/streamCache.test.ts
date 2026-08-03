import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Track } from '@lyrika/core';

const resolveStream = vi.fn();

vi.mock('./ytdlp.js', () => ({
  resolveStream: (track: Track) => resolveStream(track) as unknown,
}));

const { cacheStream, clearStreamCache, evictStream, getStream, peekStream, shouldEvictOn } =
  await import('./streamCache.js');

const track: Track = {
  id: 'youtube:abc123',
  provider: 'youtube',
  providerId: 'abc123',
  title: 'Тест',
  artist: 'Тест',
  album: null,
  durationSec: 200,
  thumbUrl: null,
};

beforeEach(() => {
  clearStreamCache();
  resolveStream.mockReset();
});

afterEach(() => {
  clearStreamCache();
});

describe('shouldEvictOn', () => {
  it('evicts on statuses that mean the URL itself is dead', () => {
    // Expired signature, or bound to an address we no longer present from.
    for (const status of [403, 404, 410]) {
      expect(shouldEvictOn(status), String(status)).toBe(true);
    }
  });

  it('does NOT evict on 416', () => {
    // Only the requested range was bad. The URL is still good, and evicting
    // would turn one bad seek into a full re-resolve.
    expect(shouldEvictOn(416)).toBe(false);
  });

  it('does not evict on success or on unrelated errors', () => {
    for (const status of [200, 206, 429, 500, 502]) {
      expect(shouldEvictOn(status), String(status)).toBe(false);
    }
  });
});

describe('cache', () => {
  it('returns nothing for an unknown track', () => {
    expect(peekStream('youtube:nope')).toBeNull();
  });

  it('round-trips a cached stream', () => {
    cacheStream(track.id, { url: 'https://cdn.example/a', mimeType: 'audio/mp4' });
    expect(peekStream(track.id)).toEqual({ url: 'https://cdn.example/a', mimeType: 'audio/mp4' });
  });

  it('forgets an evicted stream', () => {
    cacheStream(track.id, { url: 'https://cdn.example/a', mimeType: 'audio/mp4' });
    evictStream(track.id);
    expect(peekStream(track.id)).toBeNull();
  });
});

describe('getStream', () => {
  it('resolves once and serves the rest from cache', async () => {
    resolveStream.mockResolvedValue({ url: 'https://cdn.example/a', mimeType: 'audio/mp4' });

    await getStream(track);
    await getStream(track);
    await getStream(track);

    expect(resolveStream).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent cold requests into a single resolve', async () => {
    // A media element opens several parallel range requests the moment it
    // starts buffering. Without coalescing each one finds an empty cache and
    // spawns its own yt-dlp process — seconds of CPU each, all for one URL.
    let release: (value: { url: string; mimeType: string }) => void = () => {};
    resolveStream.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const inflight = Promise.all([getStream(track), getStream(track), getStream(track)]);
    release({ url: 'https://cdn.example/a', mimeType: 'audio/mp4' });
    const results = await inflight;

    expect(resolveStream).toHaveBeenCalledTimes(1);
    for (const result of results) expect(result.url).toBe('https://cdn.example/a');
  });

  it('does not cache a failed resolve, so the next attempt retries', async () => {
    resolveStream.mockRejectedValueOnce(new Error('boom'));
    await expect(getStream(track)).rejects.toThrow('boom');

    resolveStream.mockResolvedValueOnce({ url: 'https://cdn.example/b', mimeType: 'audio/mp4' });
    expect((await getStream(track)).url).toBe('https://cdn.example/b');
    expect(resolveStream).toHaveBeenCalledTimes(2);
  });
});
