import { describe, expect, it } from 'vitest';
import { contentRange, parseRange } from './range.js';

const SIZE = 1000;

describe('parseRange', () => {
  it('reports no range when the header is absent', () => {
    expect(parseRange(undefined, SIZE)).toEqual({ kind: 'none' });
  });

  it('parses a closed range', () => {
    expect(parseRange('bytes=0-499', SIZE)).toEqual({
      kind: 'range',
      range: { start: 0, end: 499 },
    });
  });

  it('parses an open-ended range as running to the last byte', () => {
    expect(parseRange('bytes=500-', SIZE)).toEqual({
      kind: 'range',
      range: { start: 500, end: 999 },
    });
  });

  it('parses a suffix range as the last N bytes', () => {
    expect(parseRange('bytes=-200', SIZE)).toEqual({
      kind: 'range',
      range: { start: 800, end: 999 },
    });
  });

  it('clamps a suffix longer than the resource', () => {
    expect(parseRange('bytes=-5000', SIZE)).toEqual({
      kind: 'range',
      range: { start: 0, end: 999 },
    });
  });

  it('clamps an end past the last byte', () => {
    expect(parseRange('bytes=900-5000', SIZE)).toEqual({
      kind: 'range',
      range: { start: 900, end: 999 },
    });
  });

  it('is case-insensitive and tolerates whitespace', () => {
    expect(parseRange('  BYTES=0-9  ', SIZE)).toEqual({
      kind: 'range',
      range: { start: 0, end: 9 },
    });
  });

  it('treats a start at or past the end as unsatisfiable, not as no-range', () => {
    // This is the case that must produce a 416 — and a 416 must NOT evict a
    // cached upstream URL, because only the range was bad, not the URL.
    expect(parseRange('bytes=1000-', SIZE)).toEqual({ kind: 'unsatisfiable' });
    expect(parseRange('bytes=5000-6000', SIZE)).toEqual({ kind: 'unsatisfiable' });
  });

  it('treats any range over an empty resource as unsatisfiable', () => {
    expect(parseRange('bytes=0-', 0)).toEqual({ kind: 'unsatisfiable' });
  });

  it('falls back to the whole resource for a multi-range request', () => {
    // Answering these needs multipart/byteranges; no media element asks for one.
    expect(parseRange('bytes=0-99,200-299', SIZE)).toEqual({ kind: 'none' });
  });

  it('ignores malformed headers rather than guessing', () => {
    for (const header of ['', 'items=0-10', 'bytes=', 'bytes=abc-def', 'bytes=-', 'bytes=10-5', 'bytes=1-2-3']) {
      expect(parseRange(header, SIZE)).toEqual({ kind: 'none' });
    }
  });

  it('rejects a negative or fractional start', () => {
    expect(parseRange('bytes=1.5-10', SIZE)).toEqual({ kind: 'none' });
  });
});

describe('contentRange', () => {
  it('formats the header', () => {
    expect(contentRange({ start: 0, end: 499 }, SIZE)).toBe('bytes 0-499/1000');
  });
});
