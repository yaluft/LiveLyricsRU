export type {
  ApiError,
  LyricKind,
  LyricLine,
  LyricWord,
  ParsedLyrics,
  StreamProvider,
  TimingKind,
  Track,
} from './types.js';

export { normaliseWord, romanise, splitWords, type SplitWord } from './romanise.js';

export { looksLikeLrc, parseLrc, parseLyrics, parsePlainLyrics } from './lyrics/lrc.js';

export {
  activeLineIndex,
  activeWordIndex,
  hasExactWordTiming,
  interpolateWords,
  type DisplayWord,
} from './lyrics/timing.js';

export { trackFromId, trackId } from './track.js';
