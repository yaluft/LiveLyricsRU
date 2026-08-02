import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { config } from '../config.js';
import { buildArgs } from './ytdlp.js';

test('buildArgs adds no cookie flags when none are configured', () => {
  config.ytDlpCookiesPath = undefined;
  const args = buildArgs(['--version']);
  assert.equal(args.includes('--cookies'), false);
  assert.equal(args.includes('--cookies-from-browser'), false);
});

test('buildArgs passes --cookies when the configured path is a real file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ytdlp-cookies-'));
  const cookiesFile = join(dir, 'cookies.txt');
  writeFileSync(cookiesFile, '# Netscape HTTP Cookie File\n');
  try {
    config.ytDlpCookiesPath = cookiesFile;
    const args = buildArgs(['--version']);
    assert.deepEqual(args, ['--version', '--cookies', cookiesFile]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    config.ytDlpCookiesPath = undefined;
  }
});

test('buildArgs ignores a configured path that is a directory (Docker empty-mount case)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ytdlp-cookies-'));
  const cookiesDir = join(dir, 'cookies.txt');
  mkdirSync(cookiesDir);
  try {
    config.ytDlpCookiesPath = cookiesDir;
    const args = buildArgs(['--version']);
    assert.equal(args.includes('--cookies'), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    config.ytDlpCookiesPath = undefined;
  }
});

test('buildArgs never emits --cookies-from-browser', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ytdlp-cookies-'));
  const cookiesFile = join(dir, 'cookies.txt');
  writeFileSync(cookiesFile, '# Netscape HTTP Cookie File\n');
  try {
    config.ytDlpCookiesPath = cookiesFile;
    assert.equal(buildArgs(['--version']).includes('--cookies-from-browser'), false);
    config.ytDlpCookiesPath = undefined;
    assert.equal(buildArgs(['--version']).includes('--cookies-from-browser'), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    config.ytDlpCookiesPath = undefined;
  }
});
