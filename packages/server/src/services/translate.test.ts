import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb, type TestDb } from '../db/testing.js';
import { translations } from '../db/schema.js';

const apiKey = { value: '' };

vi.mock('../config.js', () => ({
  config: {
    get anthropicApiKey() {
      return apiKey.value;
    },
    translationModel: 'claude-sonnet-5',
  },
}));

const { lineHash, translateLines, translationEnabled } = await import('./translate.js');

let ctx: TestDb;
const fetchMock = vi.fn();

beforeEach(async () => {
  ctx = await createTestDb();
  apiKey.value = '';
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  ctx.close();
  vi.unstubAllGlobals();
});

function reply(lines: string[]): Response {
  return {
    ok: true,
    json: async () => ({ content: [{ type: 'text', text: JSON.stringify(lines) }] }),
  } as Response;
}

describe('lineHash', () => {
  it('ignores surrounding space and case, so a repeated chorus hashes once', () => {
    expect(lineHash('  Где свет  ')).toBe(lineHash('где свет'));
  });

  it('distinguishes different lines', () => {
    expect(lineHash('Где свет')).not.toBe(lineHash('Где тьма'));
  });
});

describe('translationEnabled', () => {
  it('is false with no key and true with one', () => {
    expect(translationEnabled()).toBe(false);
    apiKey.value = 'sk-test';
    expect(translationEnabled()).toBe(true);
  });
});

describe('translateLines — no API key', () => {
  it('returns empty rather than throwing', async () => {
    // The UI then hides the translation row entirely. v2 printed
    // "перевод недоступен" under every line of every real track instead.
    const result = await translateLines(ctx.db, ['Где свет']);

    expect(result.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still serves anything already cached', async () => {
    await ctx.db.insert(translations).values({
      lineHash: lineHash('Где свет'),
      targetLang: 'en',
      text: 'Where the light is',
      model: 'test',
      createdAt: Date.now(),
    });

    const result = await translateLines(ctx.db, ['Где свет']);
    expect(result.get(lineHash('Где свет'))).toBe('Where the light is');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('translateLines — with an API key', () => {
  beforeEach(() => {
    apiKey.value = 'sk-test';
  });

  it('translates and caches', async () => {
    fetchMock.mockResolvedValue(reply(['Where the light never goes out']));

    const result = await translateLines(ctx.db, ['Где свет никогда не гаснет']);
    expect(result.get(lineHash('Где свет никогда не гаснет'))).toBe(
      'Where the light never goes out',
    );

    const rows = await ctx.db.select().from(translations);
    expect(rows).toHaveLength(1);
  });

  it('pays for a repeated chorus only once', async () => {
    fetchMock.mockResolvedValue(reply(['Where the light is']));

    await translateLines(ctx.db, ['Где свет', 'Где свет', 'Где свет']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [body] = fetchMock.mock.calls[0]!.slice(1) as [{ body: string }];
    const sent = JSON.parse(body.body) as { messages: { content: string }[] };
    expect(sent.messages[0]?.content).toContain('1 lines');
  });

  it('issues no request at all when every line is cached', async () => {
    fetchMock.mockResolvedValue(reply(['Where the light is']));
    await translateLines(ctx.db, ['Где свет']);
    fetchMock.mockClear();

    await translateLines(ctx.db, ['Где свет']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('discards a batch whose length does not match the input', async () => {
    // A short or long array means the line mapping is unreliable. Storing it
    // would pair lines with the wrong translations — silently and permanently.
    fetchMock.mockResolvedValue(reply(['only one']));

    const result = await translateLines(ctx.db, ['Первая', 'Вторая', 'Третья']);

    expect(result.size).toBe(0);
    expect(await ctx.db.select().from(translations)).toHaveLength(0);
  });

  it('tolerates a fenced JSON reply', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '```json\n["Where the light is"]\n```' }],
      }),
    } as Response);

    const result = await translateLines(ctx.db, ['Где свет']);
    expect(result.get(lineHash('Где свет'))).toBe('Where the light is');
  });

  it('survives a non-ok response without throwing', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 } as Response);

    await expect(translateLines(ctx.db, ['Где свет'])).resolves.toBeInstanceOf(Map);
    expect(await ctx.db.select().from(translations)).toHaveLength(0);
  });

  it('survives a network error without throwing', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(translateLines(ctx.db, ['Где свет'])).resolves.toBeInstanceOf(Map);
  });

  it('sends the key and API version headers', async () => {
    fetchMock.mockResolvedValue(reply(['Where the light is']));
    await translateLines(ctx.db, ['Где свет']);

    const [, init] = fetchMock.mock.calls[0]! as [string, { headers: Record<string, string> }];
    expect(init.headers['x-api-key']).toBe('sk-test');
    expect(init.headers['anthropic-version']).toBeTruthy();
  });
});
