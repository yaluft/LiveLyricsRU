import { expect, test, type APIRequestContext } from '@playwright/test';
import { LINE_TIMED_LRC, makeWav, WORD_TIMED_LRC } from './fixtures.js';

const WAV = makeWav(3);

interface UploadResponse {
  track: { id: string; provider: string; title: string; durationSec: number };
  lyrics: { kind: string; timingKind: string; lineCount: number } | null;
}

async function upload(
  request: APIRequestContext,
  options: { lrc?: string; title?: string; wav?: Buffer } = {},
): Promise<UploadResponse> {
  const response = await request.post('/api/uploads', {
    multipart: {
      // Fields deliberately written *after* the file, to prove the route does
      // not depend on multipart part ordering.
      audio: {
        name: 'tone.wav',
        mimeType: 'audio/wav',
        buffer: options.wav ?? WAV,
      },
      ...(options.lrc ? { lrc: options.lrc } : {}),
      title: options.title ?? 'Тестовый трек',
      artist: 'Тест',
      durationSec: '3',
    },
  });

  expect(response.status()).toBe(201);
  return (await response.json()) as UploadResponse;
}

test('upload registers a playable track', async ({ request }) => {
  const { track } = await upload(request);

  expect(track.provider).toBe('upload');
  expect(track.id).toMatch(/^upload:[0-9a-f]{64}$/);
  expect(track.title).toBe('Тестовый трек');
  expect(track.durationSec).toBe(3);
});

test('upload is content-addressed, so re-uploading is idempotent', async ({ request }) => {
  const first = await upload(request, { title: 'Первый' });
  const second = await upload(request, { title: 'Второй' });

  expect(second.track.id).toBe(first.track.id);
  // The later, better metadata wins rather than being silently discarded.
  expect(second.track.title).toBe('Второй');
});

test('an Enhanced LRC sidecar is stored as real word timing', async ({ request }) => {
  const { lyrics } = await upload(request, { lrc: WORD_TIMED_LRC });

  expect(lyrics).not.toBeNull();
  expect(lyrics?.kind).toBe('synced');
  expect(lyrics?.timingKind).toBe('word');
  expect(lyrics?.lineCount).toBe(2);
});

test('a plain LRC sidecar is stored as line timing, not upgraded to word', async ({ request }) => {
  // The distinction v2 destroyed: it derived word offsets at parse time and
  // stored them, so a line-timed source became indistinguishable from a
  // word-timed one.
  const { lyrics } = await upload(request, { lrc: LINE_TIMED_LRC });

  expect(lyrics?.timingKind).toBe('line');
});

test('a non-audio upload is refused with a usable hint', async ({ request }) => {
  const response = await request.post('/api/uploads', {
    multipart: {
      audio: { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') },
    },
  });

  expect(response.status()).toBe(415);
  const body = (await response.json()) as { error: string; hint?: string };
  expect(body.error).toBe('unsupported_media');
  expect(body.hint).toBeTruthy();
});

test('a request with no audio part is refused', async ({ request }) => {
  const response = await request.post('/api/uploads', {
    multipart: { title: 'ничего' },
  });

  expect(response.status()).toBe(400);
});

test.describe('range serving', () => {
  test('serves the whole file when no Range is sent', async ({ request }) => {
    const { track } = await upload(request);
    const response = await request.get(`/api/stream/${track.id}`);

    expect(response.status()).toBe(200);
    expect(response.headers()['accept-ranges']).toBe('bytes');
    expect(response.headers()['content-type']).toContain('audio/wav');
    expect((await response.body()).byteLength).toBe(WAV.byteLength);
  });

  test('answers a closed range with 206 and the right bytes', async ({ request }) => {
    const { track } = await upload(request);
    const response = await request.get(`/api/stream/${track.id}`, {
      headers: { Range: 'bytes=0-43' },
    });

    expect(response.status()).toBe(206);
    expect(response.headers()['content-range']).toBe(`bytes 0-43/${WAV.byteLength}`);

    const body = await response.body();
    expect(body.byteLength).toBe(44);
    // The WAV header, proving the offsets are real and not off by one.
    expect(body.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(body.subarray(8, 12).toString('ascii')).toBe('WAVE');
  });

  test('answers an open-ended range from the offset to the last byte', async ({ request }) => {
    const { track } = await upload(request);
    const offset = WAV.byteLength - 100;
    const response = await request.get(`/api/stream/${track.id}`, {
      headers: { Range: `bytes=${offset}-` },
    });

    expect(response.status()).toBe(206);
    expect((await response.body()).byteLength).toBe(100);
  });

  test('answers a suffix range with the last N bytes', async ({ request }) => {
    const { track } = await upload(request);
    const response = await request.get(`/api/stream/${track.id}`, {
      headers: { Range: 'bytes=-64' },
    });

    expect(response.status()).toBe(206);
    expect(await response.body()).toEqual(WAV.subarray(WAV.byteLength - 64));
  });

  test('answers an unsatisfiable range with 416, not 200', async ({ request }) => {
    const { track } = await upload(request);
    const response = await request.get(`/api/stream/${track.id}`, {
      headers: { Range: `bytes=${WAV.byteLength + 10}-` },
    });

    expect(response.status()).toBe(416);
    expect(response.headers()['content-range']).toBe(`bytes */${WAV.byteLength}`);
  });

  test('404s an unknown track', async ({ request }) => {
    const response = await request.get(`/api/stream/upload:${'0'.repeat(64)}`);

    expect(response.status()).toBe(404);
  });

  test('rejects a malformed track id rather than touching the filesystem', async ({ request }) => {
    const response = await request.get('/api/stream/not-a-valid-id');

    expect(response.status()).toBe(404);
  });
});

test('an uploaded track actually decodes and plays in the browser', async ({ page, request }) => {
  // The point of the whole upload path: this exercises the real <audio>
  // element against the real range-serving route, with no yt-dlp and no
  // network. v2's equivalent guarantee ran on a virtual clock instead.
  const { track } = await upload(request);

  await page.goto('/');
  const played = await page.evaluate(async (streamUrl) => {
    const audio = new Audio(streamUrl);
    audio.muted = true;
    await new Promise<void>((resolve, reject) => {
      audio.addEventListener('loadedmetadata', () => resolve(), { once: true });
      audio.addEventListener('error', () => reject(new Error('audio failed to load')), {
        once: true,
      });
      setTimeout(() => reject(new Error('timed out loading audio')), 10_000);
    });
    return { duration: audio.duration };
  }, `/api/stream/${track.id}`);

  expect(played.duration).toBeGreaterThan(2.5);
  expect(played.duration).toBeLessThan(3.5);
});
