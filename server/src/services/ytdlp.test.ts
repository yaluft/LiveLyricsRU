import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { isUsableCookiesFile } from './ytdlp.js';

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
