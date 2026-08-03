export interface ByteRange {
  start: number;
  end: number;
}

export type RangeResult =
  | { kind: 'none' }
  /** Satisfiable: inclusive byte offsets, already clamped to the resource size. */
  | { kind: 'range'; range: ByteRange }
  /** Syntactically valid but outside the resource — the caller must answer 416. */
  | { kind: 'unsatisfiable' };

/**
 * Parses a single-range `Range: bytes=…` header.
 *
 * Multi-range requests are deliberately treated as no range at all: answering
 * them requires a multipart/byteranges body, and no media element issues them.
 * Serving the whole resource is a correct, if unoptimised, response — whereas a
 * malformed 206 would break playback.
 */
export function parseRange(header: string | undefined, size: number): RangeResult {
  if (!header) return { kind: 'none' };

  const match = /^bytes=(.*)$/i.exec(header.trim());
  if (!match) return { kind: 'none' };

  const spec = match[1]!.trim();
  if (spec.includes(',')) return { kind: 'none' };

  const [rawStart, rawEnd, ...rest] = spec.split('-');
  if (rawEnd === undefined || rest.length > 0) return { kind: 'none' };

  const hasStart = rawStart !== '';
  const hasEnd = rawEnd !== '';
  if (!hasStart && !hasEnd) return { kind: 'none' };

  // An empty resource cannot satisfy any range.
  if (size === 0) return { kind: 'unsatisfiable' };

  if (!hasStart) {
    // Suffix form: `bytes=-500` means the *last* 500 bytes.
    const suffix = Number(rawEnd);
    if (!Number.isInteger(suffix) || suffix <= 0) return { kind: 'none' };
    return { kind: 'range', range: { start: Math.max(size - suffix, 0), end: size - 1 } };
  }

  const start = Number(rawStart);
  if (!Number.isInteger(start) || start < 0) return { kind: 'none' };
  if (start >= size) return { kind: 'unsatisfiable' };

  if (!hasEnd) return { kind: 'range', range: { start, end: size - 1 } };

  const end = Number(rawEnd);
  if (!Number.isInteger(end) || end < start) return { kind: 'none' };

  return { kind: 'range', range: { start, end: Math.min(end, size - 1) } };
}

export function contentRange(range: ByteRange, size: number): string {
  return `bytes ${range.start}-${range.end}/${size}`;
}
