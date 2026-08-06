import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseWiktionary } from './wiktionary.js';

function response(pos: string, definitionHtml: string, language = 'Russian'): unknown {
  return {
    ru: [{ partOfSpeech: pos, language, definitions: [{ definition: definitionHtml }] }],
  };
}

test('parseWiktionary reads the first Russian definition and strips HTML', () => {
  const out = parseWiktionary(response('Noun', 'a <a href="/wiki/house">house</a>'), 'дом');
  assert.equal(out?.gloss, 'a house');
  assert.equal(out?.partOfSpeech, 'Noun');
  assert.equal(out?.lemma, 'дом');
  assert.equal(out?.note, 'Wiktionary');
});

test('parseWiktionary trims to the first sense/sentence', () => {
  const out = parseWiktionary(response('Noun', 'first sense. second sense.'), 'дом');
  assert.equal(out?.gloss, 'first sense.');
});

test('parseWiktionary skips empty definitions and finds the next', () => {
  const json = {
    ru: [
      { partOfSpeech: 'Noun', definitions: [{ definition: '   ' }] },
      { partOfSpeech: 'Verb', definitions: [{ definition: 'to do something' }] },
    ],
  };
  const out = parseWiktionary(json, 'дело');
  assert.equal(out?.gloss, 'to do something');
  assert.equal(out?.partOfSpeech, 'Verb');
});

test('parseWiktionary returns null without a Russian section', () => {
  assert.equal(parseWiktionary({ en: [{ definitions: [{ definition: 'x' }] }] }, 'x'), null);
  assert.equal(parseWiktionary({}, 'x'), null);
  assert.equal(parseWiktionary(null, 'x'), null);
});
