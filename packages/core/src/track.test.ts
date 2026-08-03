import { describe, expect, it } from 'vitest';
import { trackFromId, trackId } from './track.js';

describe('trackId', () => {
  it('joins provider and id', () => {
    expect(trackId('youtube', 'dQw4w9WgXcQ')).toBe('youtube:dQw4w9WgXcQ');
  });
});

describe('trackFromId', () => {
  it('reconstructs a minimal track', () => {
    const track = trackFromId('youtube:dQw4w9WgXcQ');

    expect(track?.provider).toBe('youtube');
    expect(track?.providerId).toBe('dQw4w9WgXcQ');
    expect(track?.id).toBe('youtube:dQw4w9WgXcQ');
  });

  it('splits on the first colon only, so provider ids may contain colons', () => {
    expect(trackFromId('upload:a:b:c')?.providerId).toBe('a:b:c');
  });

  it('rejects an unknown provider', () => {
    expect(trackFromId('spotify:abc')).toBeNull();
  });

  it('rejects malformed ids', () => {
    expect(trackFromId('youtube')).toBeNull();
    expect(trackFromId('youtube:')).toBeNull();
    expect(trackFromId(':abc')).toBeNull();
    expect(trackFromId('')).toBeNull();
  });
});
