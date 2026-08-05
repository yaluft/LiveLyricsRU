/**
 * Minimal vendored slice of `@lyrika/shared` (see /shared/src/index.ts in the
 * main repo). This spike is a standalone Vite project and deliberately does
 * NOT depend on building the monorepo's `shared` workspace — see
 * spike/solid-stage/README.md for why. `ocean.ts` and `engine.ts` were copied
 * byte-for-byte from the real client; this file exists only so their
 * `@lyrika/shared` import resolves (aliased in vite.config.ts /
 * tsconfig.app.json), not to change anything about those copied files.
 *
 * Kept in sync by hand with the fields this prototype actually touches.
 */

export type StreamProvider = 'youtube' | 'vk' | 'spotify' | 'demo' | 'file';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationSec: number;
  provider: StreamProvider;
  providerId: string;
  artworkUrl?: string;
  hasSyncedLyrics: boolean;
}

export interface ResolvedStream {
  trackId: string;
  url: string;
  mimeType: string;
  bitrateKbps: number;
  provider: StreamProvider;
  expiresAt: number | null;
}

export interface LyricWord {
  text: string;
  translit: string;
  offset?: number;
}

export interface LyricLine {
  id: string;
  time: number;
  end: number;
  text: string;
  translit: string;
  translation: string;
  words: LyricWord[];
}

export type LyricKind = 'synced' | 'plain' | 'draft';
export type LyricSourceId = 'lrclib' | 'netease' | 'genius' | 'custom' | 'ai';

export interface Lyrics {
  trackId: string;
  kind: LyricKind;
  source: LyricSourceId;
  sourceLabel: string;
  lines: LyricLine[];
}

export interface WordDefinition {
  word: string;
  lemma: string;
  translit: string;
  partOfSpeech: string;
  gloss: string;
  note?: string;
}

export const WAVE_PRESETS = ['calm', 'surf', 'night', 'lagoon'] as const;
export type WavePreset = (typeof WAVE_PRESETS)[number];

export interface WaveTheme {
  id: WavePreset;
  fog: string;
  surface: string;
  atmosphere: string;
}

export const WAVE_THEMES: Record<WavePreset, WaveTheme> = {
  calm: { id: 'calm', fog: '#001a2e', surface: '#0a5c8a', atmosphere: '#4fd2ff' },
  surf: { id: 'surf', fog: '#00121f', surface: '#0d7fd0', atmosphere: '#7fe4ff' },
  night: { id: 'night', fog: '#050a18', surface: '#2a1a6a', atmosphere: '#8f7fff' },
  lagoon: { id: 'lagoon', fog: '#0b1a12', surface: '#0f8a6a', atmosphere: '#5fffd0' },
};
