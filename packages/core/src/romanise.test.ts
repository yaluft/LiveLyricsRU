import { describe, expect, it } from 'vitest';
import { normaliseWord, romanise, splitWords } from './romanise.js';

describe('romanise', () => {
  it('spells out iotated vowels so the row reads as sound, not spelling', () => {
    expect(romanise('Где свет никогда не гаснет')).toBe('gdye svyet nikogda nye gasnyet');
  });

  it('handles the multi-letter consonants', () => {
    expect(romanise('щука хочу цирк жар шар')).toBe('shchuka khochu tsirk zhar shar');
  });

  it('drops the hard and soft signs rather than printing quote marks', () => {
    expect(romanise('статья')).toBe('statya');
    expect(romanise('объект')).toBe('obyekt');
  });

  it('passes non-Cyrillic through unchanged', () => {
    expect(romanise('rock-n-roll, 2024!')).toBe('rock-n-roll, 2024!');
  });

  it('maps ё distinctly from е', () => {
    expect(romanise('ёж')).toBe('yozh');
    expect(romanise('еж')).toBe('yezh');
  });
});

describe('splitWords', () => {
  it('returns each word with its offset into the line', () => {
    expect(splitWords('Где свет')).toEqual([
      { text: 'Где', index: 0 },
      { text: 'свет', index: 4 },
    ]);
  });

  it('keeps hyphens and apostrophes inside a word', () => {
    expect(splitWords("«что-то»").map((word) => word.text)).toEqual(['что-то']);
  });

  it('drops punctuation between words', () => {
    expect(splitWords('раз, два!').map((word) => word.text)).toEqual(['раз', 'два']);
  });

  it('returns nothing for an empty line', () => {
    expect(splitWords('   ')).toEqual([]);
  });
});

describe('normaliseWord', () => {
  it('lowercases, folds ё to е, and strips punctuation', () => {
    expect(normaliseWord('Ёжик,')).toBe('ежик');
    expect(normaliseWord('«ГАСНЕТ»')).toBe('гаснет');
  });

  it('keeps hyphens so compound words stay one key', () => {
    expect(normaliseWord('что-то')).toBe('что-то');
  });
});
