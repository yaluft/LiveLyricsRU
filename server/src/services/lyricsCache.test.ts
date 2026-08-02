import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Lyrics } from '@lyrika/shared';
import { createDb } from '../lib/db.js';
import { getCachedLyrics, setCachedLyrics } from './lyricsCache.js';

const sampleLyrics: Lyrics = {
  trackId: 'demo:sample',
  kind: 'synced',
  source: 'lrclib',
  sourceLabel: 'LRCLIB',
  lines: [
    { id: 'l1', time: 0, end: 2, text: 'Привет', translit: 'privyet', translation: 'Hello', words: [] },
  ],
};

test('a miss returns null', () => {
  const db = createDb(':memory:');
  assert.equal(getCachedLyrics('demo:missing', db), null);
});

test('set-then-get round-trips a full Lyrics object', () => {
  const db = createDb(':memory:');
  setCachedLyrics(sampleLyrics.trackId, sampleLyrics, db);
  const result = getCachedLyrics(sampleLyrics.trackId, db);
  assert.notEqual(result, null);
  assert.notEqual(result, 'not_found');
  const lyrics = result as Lyrics;
  assert.equal(lyrics.trackId, sampleLyrics.trackId);
  assert.equal(lyrics.kind, sampleLyrics.kind);
  assert.equal(lyrics.source, sampleLyrics.source);
  assert.equal(lyrics.sourceLabel, sampleLyrics.sourceLabel);
  assert.deepEqual(lyrics.lines, sampleLyrics.lines);
});

test('an expired row is treated as a fresh miss', () => {
  const db = createDb(':memory:');
  const now = Date.now();
  db.prepare(
    `INSERT INTO lyrics_cache (track_id, found, kind, source, source_label, payload, fetched_at, expires_at)
     VALUES (@trackId, @found, @kind, @source, @sourceLabel, @payload, @fetchedAt, @expiresAt)`,
  ).run({
    trackId: 'demo:expired',
    found: 1,
    kind: sampleLyrics.kind,
    source: sampleLyrics.source,
    sourceLabel: sampleLyrics.sourceLabel,
    payload: JSON.stringify(sampleLyrics.lines),
    fetchedAt: now - 1000,
    expiresAt: now - 500,
  });
  assert.equal(getCachedLyrics('demo:expired', db), null);
});

test('a negative/tombstone entry returns not_found, distinguishable from a miss', () => {
  const db = createDb(':memory:');
  setCachedLyrics('demo:nowhere', null, db);
  assert.equal(getCachedLyrics('demo:nowhere', db), 'not_found');
  assert.equal(getCachedLyrics('demo:never-cached', db), null);
});
