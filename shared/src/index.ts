export type LyricSourceId = 'lrclib' | 'netease' | 'genius' | 'custom' | 'ai';

export type LyricKind = 'synced' | 'plain' | 'draft';

export interface LyricWord {
  /** Surface form as it appears in the line. */
  text: string;
  /** Latin transliteration shown above the word. */
  translit: string;
  /** Offset from the line start, in seconds. Absent for unsynced words. */
  offset?: number;
}

export interface LyricLine {
  id: string;
  /** Absolute start time in seconds. */
  time: number;
  /** Absolute end time in seconds. */
  end: number;
  text: string;
  translit: string;
  translation: string;
  words: LyricWord[];
}

export interface Lyrics {
  trackId: string;
  kind: LyricKind;
  source: LyricSourceId;
  sourceLabel: string;
  lines: LyricLine[];
}

export type StreamProvider = 'youtube' | 'vk' | 'spotify' | 'demo' | 'file';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationSec: number;
  provider: StreamProvider;
  /** Provider-native identifier, e.g. a YouTube video id. */
  providerId: string;
  artworkUrl?: string;
  /** Whether a time-synced lyric source is known to exist for this track. */
  hasSyncedLyrics: boolean;
}

export interface SearchResponse {
  query: string;
  results: Track[];
  /** True when the catalogue fallback answered because no resolver was available. */
  sampled: boolean;
}

export interface ResolvedStream {
  trackId: string;
  url: string;
  mimeType: string;
  bitrateKbps: number;
  provider: StreamProvider;
  expiresAt: number | null;
}

export interface ApiError {
  error: string;
  message: string;
  /** A follow-up the UI can offer, e.g. retry on a different provider. */
  hint?: string;
}

export interface WordDefinition {
  word: string;
  lemma: string;
  translit: string;
  partOfSpeech: string;
  gloss: string;
  note?: string;
}

export interface ArtistProfile {
  id: string;
  name: string;
  origin: string;
  activeYears: string;
  genres: string[];
  photoUrl?: string;
  topTracks: { title: string; durationSec: number; trackId?: string }[];
  topCountries: { country: string; share: number }[];
  discography: { title: string; year: number; coverUrl?: string }[];
  /** Mocked provenance so the UI can label estimated figures honestly. */
  estimated: boolean;
}

export interface SavedWord {
  id: string;
  word: string;
  translit: string;
  gloss: string;
  trackId: string;
  trackTitle: string;
  atSec: number;
  seenCount: number;
  savedAt: number;
}

export interface SavedLine {
  id: string;
  text: string;
  translation: string;
  trackId: string;
  trackTitle: string;
  startSec: number;
  endSec: number;
  savedAt: number;
}

export interface Clip {
  id: string;
  trackId: string;
  trackTitle: string;
  artist: string;
  startSec: number;
  endSec: number;
  lineText: string;
  translit: string;
  translation: string;
  show: { translit: boolean; translation: boolean; waves: boolean; artwork: boolean };
  author: string;
  likes: number;
  createdAt: number;
}

export interface AiLyricRequest {
  /** Either a track query ("Земфира — Искала") or a media URL. */
  query: string;
  trackId?: string;
  withTranslit: boolean;
  withTranslation: boolean;
}

export interface AiLyricResponse {
  lyrics: Lyrics;
  /** Always true in this build: no transcription model is wired up. */
  simulated: boolean;
  notice: string;
}

export interface FeedResponse {
  clips: Clip[];
  simulated: boolean;
}

export const CLIP_WINDOW_SEC = 10;

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
