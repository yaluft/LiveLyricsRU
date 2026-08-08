import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  extractJson,
  parseGeneratedLines,
  parseLrcLines,
  parseTranslations,
  parseWordSense,
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

test('parseWordSense reads a full definition object', () => {
  const raw = '{"lemma":"дом","partOfSpeech":"noun","gloss":"house","note":"masculine"}';
  assert.deepEqual(parseWordSense(raw), {
    lemma: 'дом',
    partOfSpeech: 'noun',
    gloss: 'house',
    note: 'masculine',
  });
});

test('parseWordSense omits an absent note', () => {
  const out = parseWordSense('{"lemma":"дом","partOfSpeech":"noun","gloss":"house"}');
  assert.deepEqual(out, { lemma: 'дом', partOfSpeech: 'noun', gloss: 'house' });
});

test('parseWordSense requires a gloss', () => {
  assert.equal(parseWordSense('{"lemma":"дом","partOfSpeech":"noun"}'), null);
  assert.equal(parseWordSense('{"gloss":"   "}'), null);
});

test('parseWordSense rejects a non-object reply', () => {
  assert.equal(parseWordSense('["house"]'), null);
  assert.equal(parseWordSense('nonsense'), null);
});

test('parseLrcLines reads timestamp/original pairs, dropping any other keys', () => {
  const raw =
    '{"lines":[' +
    '{"timestamp":"00:12.50","original":"Строка один","pronunciation":"ignored","english":"ignored"},' +
    '{"timestamp":"00:18.00","original":"Строка два"}' +
    ']}';
  assert.deepEqual(parseLrcLines(raw), [
    { timestamp: '00:12.50', original: 'Строка один' },
    { timestamp: '00:18.00', original: 'Строка два' },
  ]);
});

test('parseLrcLines skips items missing a timestamp or original', () => {
  const raw =
    '{"lines":[{"timestamp":"00:12.50"},{"original":"orphan"},{"timestamp":"00:18.00","original":"ок"}]}';
  assert.deepEqual(parseLrcLines(raw), [{ timestamp: '00:18.00', original: 'ок' }]);
});

test('parseLrcLines returns null when nothing usable is present', () => {
  assert.equal(parseLrcLines('{"lines":[]}'), null);
  assert.equal(parseLrcLines('{"lines":"not an array"}'), null);
  assert.equal(parseLrcLines('garbage'), null);
});
