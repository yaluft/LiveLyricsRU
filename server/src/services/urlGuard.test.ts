import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkMediaUrl, looksLikeUrl } from './urlGuard.js';
import { parseLrc } from '../lib/lrc.js';
import { transliterate } from '../lib/transliterate.js';

test('accepts YouTube hosts', () => {
  const result = checkMediaUrl('https://www.youtube.com/watch?v=abc123');
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.provider, 'youtube');
});

test('accepts youtu.be short links', () => {
  assert.equal(checkMediaUrl('https://youtu.be/abc123').ok, true);
});

test('rejects hosts outside the allowlist', () => {
  assert.equal(checkMediaUrl('https://evil.example.com/x').ok, false);
});

test('rejects a lookalike host that merely contains an allowed domain', () => {
  assert.equal(checkMediaUrl('https://youtube.com.evil.example/x').ok, false);
});

test('rejects non-http protocols', () => {
  assert.equal(checkMediaUrl('file:///etc/passwd').ok, false);
  assert.equal(checkMediaUrl('gopher://youtube.com/x').ok, false);
});

test('rejects IP literals and loopback', () => {
  assert.equal(checkMediaUrl('http://127.0.0.1:8787/api/health').ok, false);
  assert.equal(checkMediaUrl('http://169.254.169.254/latest/meta-data/').ok, false);
  assert.equal(checkMediaUrl('http://[::1]/').ok, false);
});

test('rejects embedded credentials', () => {
  assert.equal(checkMediaUrl('https://user:pw@youtube.com/watch?v=a').ok, false);
});

test('looksLikeUrl only matches http(s)', () => {
  assert.equal(looksLikeUrl('https://youtu.be/a'), true);
  assert.equal(looksLikeUrl('Земфира'), false);
});

test('parses LRC timestamps including multi-stamp lines', () => {
  const parsed = parseLrc('[00:12.50]Тихую песню\n[00:18.00][01:02.25]Где свет');
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0]?.time, 12.5);
  assert.equal(parsed[1]?.text, 'Где свет');
  assert.equal(parsed[2]?.time, 62.25);
});

test('transliterates iotated vowels the way the design shows them', () => {
  assert.equal(transliterate('Где свет никогда не гаснет'), 'gdye svyet nikogda nye gasnyet');
  assert.equal(transliterate('Тихую песню про небо'), 'tikhuyu pyesnyu pro nyebo');
  assert.equal(transliterate('И ветер носит имя твоё'), 'i vyetyer nosit imya tvoyo');
  assert.equal(transliterate('Мы будем помнить это лето'), 'my budyem pomnit\' eto lyeto');
});
