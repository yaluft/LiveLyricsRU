import { describe, expect, it } from 'vitest';
import { parseLrc } from './lrc.js';
import { activeLineIndex, activeWordIndex, hasExactWordTiming, interpolateWords } from './timing.js';

describe('interpolateWords', () => {
  it('marks derived timings as inexact', () => {
    const line = parseLrc('[00:10.00]раз два\n[00:14.00]три').lines[0]!;
    const words = interpolateWords(line);

    expect(words.every((word) => word.exact)).toBe(false);
    expect(words[0]?.startMs).toBe(10_000);
    expect(words.at(-1)?.endMs).toBe(14_000);
  });

  it('weights by word length rather than splitting evenly', () => {
    // "я" (1 char) and "никогда" (7) share a 4s span 1:7, not 1:1 — v2 split it
    // evenly, which is what made the highlight drift on long words.
    const line = parseLrc('[00:10.00]я никогда\n[00:14.00].').lines[0]!;
    const [short, long] = interpolateWords(line);

    expect(short?.endMs).toBe(10_500);
    expect(long?.startMs).toBe(10_500);
  });

  it('passes source timings through untouched and marks them exact', () => {
    const line = parseLrc('[00:12.00]<00:12.00>Где <00:12.44>свет\n[00:20.00].').lines[0]!;
    const words = interpolateWords(line);

    expect(words.every((word) => word.exact)).toBe(true);
    expect(words.map((word) => word.startMs)).toEqual([12_000, 12_440]);
  });

  it('falls back to a minimum span for a trailing line with no end', () => {
    const line = parseLrc('[00:10.00]одна').lines[0]!;
    const words = interpolateWords(line);

    expect(words[0]?.endMs).toBeGreaterThan(words[0]!.startMs);
  });

  it('honours an explicit fallback end for the trailing line', () => {
    const line = parseLrc('[00:10.00]раз два').lines[0]!;
    const words = interpolateWords(line, 18_000);

    expect(words.at(-1)?.endMs).toBe(18_000);
  });
});

describe('activeLineIndex', () => {
  const lines = parseLrc('[00:10.00]a\n[00:20.00]b\n[00:30.00]c').lines;

  it('returns -1 before the first line', () => {
    expect(activeLineIndex(lines, 9_999)).toBe(-1);
  });

  it('is inclusive of a line start', () => {
    expect(activeLineIndex(lines, 10_000)).toBe(0);
    expect(activeLineIndex(lines, 20_000)).toBe(1);
  });

  it('holds the last line past the end', () => {
    expect(activeLineIndex(lines, 999_000)).toBe(2);
  });

  it('handles an empty document', () => {
    expect(activeLineIndex([], 1_000)).toBe(-1);
  });
});

describe('activeWordIndex', () => {
  const line = parseLrc('[00:12.00]<00:12.00>раз <00:13.00>два\n[00:20.00].').lines[0]!;
  const words = interpolateWords(line);

  it('returns -1 before the first word', () => {
    expect(activeWordIndex(words, 11_000)).toBe(-1);
  });

  it('advances with position', () => {
    expect(activeWordIndex(words, 12_500)).toBe(0);
    expect(activeWordIndex(words, 13_000)).toBe(1);
  });
});

describe('hasExactWordTiming', () => {
  it('distinguishes A2 from plain LRC', () => {
    expect(hasExactWordTiming(parseLrc('[00:10.00]<00:10.00>раз').lines[0]!.words)).toBe(true);
    expect(hasExactWordTiming(parseLrc('[00:10.00]раз').lines[0]!.words)).toBe(false);
  });
});
