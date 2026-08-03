/** Whether a lyric document carries timing at all. */
export type LyricKind = 'synced' | 'plain';

/**
 * How precise the *source's* timing was. This is deliberately a record of what
 * arrived, never of what we derived from it.
 *
 * v2 stored word offsets computed by dividing a line's span evenly across its
 * words, which made an interpolation indistinguishable from real data once it
 * hit the database. v3 stores `'line'` in that case and leaves `LyricWord.startMs`
 * null, so a consumer that wants a moving word highlight has to interpolate
 * explicitly — and the UI can render that case differently, because it can tell.
 */
export type TimingKind = 'word' | 'line' | 'none';

export interface LyricWord {
  text: string;
  romanised: string;
  /** Null unless the source carried per-word timing (`TimingKind` `'word'`). */
  startMs: number | null;
  endMs: number | null;
}

export interface LyricLine {
  idx: number;
  /** Null for unsynced documents (`TimingKind` `'none'`). */
  startMs: number | null;
  endMs: number | null;
  text: string;
  romanised: string;
  words: LyricWord[];
}

export interface ParsedLyrics {
  kind: LyricKind;
  timingKind: TimingKind;
  lines: LyricLine[];
}

export type StreamProvider = 'youtube' | 'vk' | 'upload';

export interface Track {
  /** Always `provider:providerId` — see the resolver's id-parsing fallback. */
  id: string;
  provider: StreamProvider;
  providerId: string;
  title: string;
  artist: string;
  album: string | null;
  durationSec: number;
  thumbUrl: string | null;
}

export interface ApiError {
  error: string;
  message: string;
  hint?: string;
}
