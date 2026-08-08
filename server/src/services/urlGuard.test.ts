import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkMediaUrl, looksLikeUrl } from './urlGuard.js';
import { parseLrc, toLyricLines } from '../lib/lrc.js';
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

test('parseLrc strips enhanced-LRC word tags out of the displayed text', () => {
  const parsed = parseLrc('[00:12.34]<00:12.34>Привет <00:12.80>мир <00:13.20>это <00:13.50>песня');
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.text, 'Привет мир это песня');
  assert.deepEqual(
    parsed[0]?.wordOffsets?.map((o) => Number(o.toFixed(2))),
    [0, 0.46, 0.86, 1.16],
  );
});

test('parseLrc leaves plain (untagged) lines exactly as before', () => {
  const parsed = parseLrc('[00:12.50] Тихую песню про небо');
  assert.equal(parsed[0]?.text, 'Тихую песню про небо');
  assert.equal(parsed[0]?.wordOffsets, undefined);
});

test('toLyricLines uses real word offsets from enhanced-LRC tags', () => {
  const parsed = parseLrc('[00:12.34]<00:12.34>Привет <00:12.80>мир <00:13.20>это <00:13.50>песня');
  const lines = toLyricLines(parsed, 240);
  assert.equal(lines[0]?.words.length, 4);
  assert.deepEqual(
    lines[0]?.words.map((w) => Number(w.offset?.toFixed(2))),
    [0, 0.46, 0.86, 1.16],
  );
});

test('toLyricLines falls back to an even split when the tag count does not match the tokenizer', () => {
  // one tag covering a two-word span: tag count (1) != tokenizer word count (2)
  const parsed = parseLrc('[00:00.00]<00:00.00>Тихую песню');
  const lines = toLyricLines(parsed, 240);
  assert.equal(lines[0]?.words.length, 2);
  assert.equal(lines[0]?.words[0]?.offset, 0);
  assert.ok((lines[0]?.words[1]?.offset ?? 0) > 0);
});

test('transliterates iotated vowels the way the design shows them', () => {
  assert.equal(transliterate('Где свет никогда не гаснет'), 'gdye svyet nikogda nye gasnyet');
  assert.equal(transliterate('Тихую песню про небо'), 'tikhuyu pyesnyu pro nyebo');
  assert.equal(transliterate('И ветер носит имя твоё'), 'i vyetyer nosit imya tvoyo');
  assert.equal(transliterate('Мы будем помнить это лето'), 'my budyem pomnit\' eto lyeto');
});
