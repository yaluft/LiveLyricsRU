import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { cleanArtist, isUsableCookiesFile, pickThumbnail } from './ytdlp.js';

test('isUsableCookiesFile accepts a regular file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lyrika-cookies-'));
  try {
    const file = join(dir, 'cookies.txt');
    writeFileSync(file, '# Netscape HTTP Cookie File\n');
    assert.equal(isUsableCookiesFile(file), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('isUsableCookiesFile rejects a directory (the empty-bind-mount case)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lyrika-cookies-'));
  try {
    const asDir = join(dir, 'cookies.txt');
    mkdirSync(asDir);
    assert.equal(isUsableCookiesFile(asDir), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('isUsableCookiesFile rejects a path that does not exist', () => {
  assert.equal(isUsableCookiesFile('/nonexistent/path/cookies.txt'), false);
});

test('cleanArtist strips a YouTube auto-generated "- Topic" channel suffix', () => {
  assert.equal(cleanArtist("5'nizza - Topic"), "5'nizza");
  assert.equal(cleanArtist('Земфира - Topic'), 'Земфира');
  assert.equal(cleanArtist('Земфира -Topic'), 'Земфира');
});

test('cleanArtist leaves a normal artist name unchanged', () => {
  assert.equal(cleanArtist('Земфира'), 'Земфира');
  assert.equal(cleanArtist('Guns N\' Roses'), 'Guns N\' Roses');
});

test('cleanArtist does not touch "Topic" as part of a real name', () => {
  assert.equal(cleanArtist('Topic'), 'Topic');
  assert.equal(cleanArtist('Not a Topic'), 'Not a Topic');
});

test('pickThumbnail prefers the singular field from full extraction', () => {
  assert.equal(
    pickThumbnail({ thumbnail: 'https://full.example/t.jpg', thumbnails: [{ url: 'https://flat.example/t.jpg' }] }),
    'https://full.example/t.jpg',
  );
});

test('pickThumbnail falls back to the last (highest-res) entry of a flat-playlist thumbnails array', () => {
  assert.equal(
    pickThumbnail({
      thumbnails: [{ url: 'https://example/small.jpg' }, { url: 'https://example/large.jpg' }],
    }),
    'https://example/large.jpg',
  );
});

test('pickThumbnail returns undefined when neither field is present', () => {
  assert.equal(pickThumbnail({}), undefined);
  assert.equal(pickThumbnail({ thumbnails: [] }), undefined);
});
