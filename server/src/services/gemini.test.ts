import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  extractJson,
  parseGeneratedLines,
  parseTranslations,
} from './gemini.js';

test('extractJson reads a bare array', () => {
  assert.deepEqual(extractJson('["a", "b"]'), ['a', 'b']);
});

test('extractJson unwraps a ```json fence', () => {
  const raw = 'Sure!\n```json\n["один", "два"]\n```\n';
  assert.deepEqual(extractJson(raw), ['один', 'два']);
});

test('extractJson slices past leading prose to the bracket pair', () => {
  assert.deepEqual(extractJson('Here you go: {"a":1} — done'), { a: 1 });
});

test('extractJson throws when there is no JSON', () => {
  assert.throws(() => extractJson('no json here'), SyntaxError);
});

test('parseTranslations returns a trimmed, aligned array', () => {
  const out = parseTranslations('[" hello ", "world"]', 2);
  assert.deepEqual(out, ['hello', 'world']);
});

test('parseTranslations discards a length mismatch rather than mispairing', () => {
  assert.equal(parseTranslations('["only one"]', 2), null);
});

test('parseTranslations accepts an object wrapper with a lines array', () => {
  const out = parseTranslations('{"lines": ["a", "b", "c"]}', 3);
  assert.deepEqual(out, ['a', 'b', 'c']);
});

test('parseTranslations pulls .translation out of object items', () => {
  const raw = '[{"translation": "hi"}, {"translation": "there"}]';
  assert.deepEqual(parseTranslations(raw, 2), ['hi', 'there']);
});

test('parseTranslations returns null on unparseable output', () => {
  assert.equal(parseTranslations('not json at all', 1), null);
});

test('parseGeneratedLines reads text/translation pairs', () => {
  const raw = '[{"text":"Привет","translation":"Hello"},{"text":"Мир","translation":"World"}]';
  assert.deepEqual(parseGeneratedLines(raw), [
    { text: 'Привет', translation: 'Hello' },
    { text: 'Мир', translation: 'World' },
  ]);
});

test('parseGeneratedLines tolerates bare strings with empty translations', () => {
  assert.deepEqual(parseGeneratedLines('["Строка"]'), [
    { text: 'Строка', translation: '' },
  ]);
});

test('parseGeneratedLines skips items with no usable text', () => {
  const raw = '[{"translation":"orphan"},{"text":"  ","translation":"blank"},{"text":"ок"}]';
  assert.deepEqual(parseGeneratedLines(raw), [{ text: 'ок', translation: '' }]);
});

test('parseGeneratedLines returns null when nothing usable is present', () => {
  assert.equal(parseGeneratedLines('[]'), null);
  assert.equal(parseGeneratedLines('garbage'), null);
});
