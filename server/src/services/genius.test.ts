import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchGeniusLyrics } from './genius.js';

// Helper to temporarily override global.fetch
function withFetch(mock: (url: string) => Promise<{ ok: boolean; text: () => Promise<string> }>) {
  const original = globalThis.fetch;
  // @ts-ignore
  globalThis.fetch = async (url: RequestInfo) => mock(String(url));
  return () => {
    // @ts-ignore
    globalThis.fetch = original;
  };
}

test('fetchGeniusLyrics returns null when no search link found', async () => {
  const restore = withFetch(async () => ({ ok: true, text: async () => '<html><body>No results</body></html>' }));
  try {
    const out = await fetchGeniusLyrics({ title: 'Nonexistent', artist: 'Nobody' });
    assert.equal(out, null);
  } finally {
    restore();
  }
});

test('fetchGeniusLyrics scrapes lyrics from a found page', async () => {
  let step = 0;
  const restore = withFetch(async (url) => {
    step += 1;
    if (step === 1) {
      // Search page with a link to a lyrics page
      return {
        ok: true,
        text: async () => '<html><a href="https://genius.com/artist-song-lyrics">link</a></html>',
      };
    }
    // Lyrics page with data-lyrics-container blocks
    return {
      ok: true,
      text: async () => '<html><div data-lyrics-container="true">Line1<br/>Line2</div></html>',
    };
  });

  try {
    const out = await fetchGeniusLyrics({ title: 'Some Song', artist: 'Some Artist' });
    assert.ok(out && typeof out === 'object');
    // Should include the scraped text
    // out.lines is a string in this implementation
    // @ts-ignore
    assert.ok(out.lines && out.lines.includes('Line1'));
  } finally {
    restore();
  }
});
