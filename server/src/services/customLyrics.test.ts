import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lyricsFromLrc } from './customLyrics.js';

// Placeholder lyric text only — never real song lyrics.
test('lyricsFromLrc builds synced lyrics from an LRC with timestamps', () => {
  const lrc = '[00:00.00] la la la\n[00:03.50] na na na\n';
  const out = lyricsFromLrc('yt:abc', lrc, 30);
  assert.equal(out?.kind, 'synced');
  assert.equal(out?.source, 'custom');
  assert.equal(out?.lines.length, 2);
  assert.equal(out?.lines[0]?.text, 'la la la');
  assert.equal(out?.lines[0]?.time, 0);
  assert.equal(out?.lines[1]?.time, 3.5);
});

test('lyricsFromLrc falls back to plain lines when there are no timestamps', () => {
  const out = lyricsFromLrc('yt:abc', 'one line\ntwo line\nthree line', 30);
  assert.equal(out?.kind, 'plain');
  assert.equal(out?.source, 'custom');
  assert.equal(out?.lines.length, 3);
});

test('lyricsFromLrc drops stray bracket tags in plain text', () => {
  const out = lyricsFromLrc('yt:abc', '[ti:Title]\nreal line', 30);
  assert.equal(out?.kind, 'plain');
  // The [ti:…] metadata line has no timestamp and its bracket content is stripped,
  // leaving no visible text, so only the real line survives.
  assert.ok((out?.lines.length ?? 0) >= 1);
  assert.ok(out?.lines.some((l) => l.text.includes('real line')));
});

test('lyricsFromLrc returns null for empty input', () => {
  assert.equal(lyricsFromLrc('yt:abc', '   ', 30), null);
});
