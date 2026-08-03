import { describe, expect, it } from 'vitest';
import { looksLikeLrc, parseLrc, parseLyrics, parsePlainLyrics } from './lrc.js';

describe('parseLrc', () => {
  it('parses line stamps into milliseconds', () => {
    const { lines, timingKind } = parseLrc('[00:12.34]Где свет никогда не гаснет');

    expect(timingKind).toBe('line');
    expect(lines).toHaveLength(1);
    expect(lines[0]?.startMs).toBe(12_340);
    expect(lines[0]?.text).toBe('Где свет никогда не гаснет');
  });

  it('handles 1-, 2- and 3-digit fractions', () => {
    const { lines } = parseLrc('[00:01.5]a\n[00:02.50]b\n[00:03.500]c');

    expect(lines.map((line) => line.startMs)).toEqual([1_500, 2_500, 3_500]);
  });

  it('accepts a colon as the fraction separator', () => {
    expect(parseLrc('[01:02:75]тест').lines[0]?.startMs).toBe(62_750);
  });

  it('expands multi-timestamp lines into one line per occurrence', () => {
    const { lines } = parseLrc('[00:10.00][01:30.00][02:50.00]припев');

    expect(lines).toHaveLength(3);
    expect(lines.map((line) => line.startMs)).toEqual([10_000, 90_000, 170_000]);
    expect(new Set(lines.map((line) => line.text))).toEqual(new Set(['припев']));
  });

  it('sorts lines by time regardless of file order', () => {
    const { lines } = parseLrc('[00:30.00]third\n[00:10.00]first\n[00:20.00]second');

    expect(lines.map((line) => line.text)).toEqual(['first', 'second', 'third']);
  });

  it('gives each line an end at the next line, and null for the last', () => {
    const { lines } = parseLrc('[00:10.00]a\n[00:14.00]b');

    expect(lines[0]?.endMs).toBe(14_000);
    expect(lines[1]?.endMs).toBeNull();
  });

  it('skips ID tags and blank lines', () => {
    const body = '[ar:Земфира]\n[ti:Искала]\n[length:03:45]\n\n[00:05.00]строка';
    const { lines } = parseLrc(body);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toBe('строка');
  });

  it('leaves word timings null when the source is plain LRC', () => {
    const { lines, timingKind } = parseLrc('[00:10.00]два слова');

    expect(timingKind).toBe('line');
    expect(lines[0]?.words.map((word) => word.text)).toEqual(['два', 'слова']);
    expect(lines[0]?.words.every((word) => word.startMs === null)).toBe(true);
  });

  it('romanises the line and each word', () => {
    const { lines } = parseLrc('[00:10.00]Где свет');

    expect(lines[0]?.romanised).toBe('gdye svyet');
    expect(lines[0]?.words.map((word) => word.romanised)).toEqual(['gdye', 'svyet']);
  });

  it('treats a bracket that is not a leading stamp as text', () => {
    const { lines } = parseLrc('[00:10.00]строка [00:20.00] в тексте');

    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toBe('строка [00:20.00] в тексте');
  });
});

describe('parseLrc — Enhanced LRC (A2)', () => {
  const body = '[00:12.00]<00:12.00>Где <00:12.44>свет <00:13.10>гаснет';

  it('reports word timing and reads each word stamp', () => {
    const { timingKind, lines } = parseLrc(body);

    expect(timingKind).toBe('word');
    expect(lines[0]?.words.map((word) => [word.text, word.startMs])).toEqual([
      ['Где', 12_000],
      ['свет', 12_440],
      ['гаснет', 13_100],
    ]);
  });

  it('ends each word at the next one', () => {
    const { lines } = parseLrc(body);

    expect(lines[0]?.words[0]?.endMs).toBe(12_440);
    expect(lines[0]?.words[1]?.endMs).toBe(13_100);
  });

  it('ends the last word at the line end', () => {
    const { lines } = parseLrc(`${body}\n[00:20.00]следующая`);

    expect(lines[0]?.words.at(-1)?.endMs).toBe(20_000);
  });

  it('rebuilds line text from the word chunks', () => {
    expect(parseLrc(body).lines[0]?.text).toBe('Где свет гаснет');
  });

  it('shifts word stamps for each occurrence of a multi-timestamp line', () => {
    const { lines } = parseLrc('[00:10.00][00:30.00]<00:10.00>раз <00:11.00>два');

    expect(lines[0]?.words.map((word) => word.startMs)).toEqual([10_000, 11_000]);
    expect(lines[1]?.words.map((word) => word.startMs)).toEqual([30_000, 31_000]);
  });

  it('folds text before the first word stamp into the first word', () => {
    const { lines } = parseLrc('[00:10.00]ох <00:10.50>да');

    expect(lines[0]?.words[0]?.text).toBe('ох да');
  });
});

describe('parsePlainLyrics', () => {
  it('keeps the text and admits it has no timing', () => {
    const { kind, timingKind, lines } = parsePlainLyrics('первая\n\nвторая\n');

    expect(kind).toBe('plain');
    expect(timingKind).toBe('none');
    expect(lines.map((line) => line.text)).toEqual(['первая', 'вторая']);
    expect(lines.every((line) => line.startMs === null)).toBe(true);
  });
});

describe('looksLikeLrc / parseLyrics', () => {
  it('detects a leading stamp', () => {
    expect(looksLikeLrc('[00:10.00]строка')).toBe(true);
    expect(looksLikeLrc('[ar:Земфира]\nпросто текст')).toBe(false);
  });

  it('dispatches on the format', () => {
    expect(parseLyrics('[00:10.00]строка').kind).toBe('synced');
    expect(parseLyrics('просто текст').kind).toBe('plain');
  });
});
