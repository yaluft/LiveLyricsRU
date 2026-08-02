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
  /** True when the user saved or edited this text locally. */
  userEdited?: boolean;
}

/** Persistent lyrics row in server/.data — JsonStore today, SQLite-ready shape. */
export interface LyricsRecord {
  trackId: string;
  kind: LyricKind;
  source: LyricSourceId;
  sourceLabel: string;
  /** Raw LRC body when synced; absent for plain sources. */
  lrcBody?: string;
  lines: LyricLine[];
  userEdited: boolean;
  /** Snapshot of the remote source before the first user edit, for diff view. */
  originalLines?: LyricLine[];
  createdAt: number;
  updatedAt: number;
}

export interface LyricsSaveRequest {
  trackId: string;
  /** LRC with timestamps, or plain text — the server detects which. */
  body: string;
  durationSec?: number;
  title?: string;
  artist?: string;
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
  /** True when no model was reachable and the local placeholder answered. */
  simulated: boolean;
  notice: string;
}

/** A line the user asked the assistant to unpack, not merely translate. */
export interface AiExplainRequest {
  text: string;
  trackTitle?: string;
  artist?: string;
  /** Surrounding lines, so the assistant can read the line in context. */
  context?: string[];
}

export interface AiExplainResponse {
  /** What the line actually says once the idiom is unwound. */
  meaning: string;
  /** The literal, word-order reading — deliberately separate from `meaning`. */
  literal: string;
  /** Idioms, wordplay, cultural references worth calling out. */
  notes: string[];
  simulated: boolean;
}

/** @deprecated Use LyricsSaveRequest — kept for older clients. */
export type CustomLyricsRequest = LyricsSaveRequest;

/** Lightweight suggestion queue entry for collaborative lyric hints. */
export interface LyricSuggestion {
  id: string;
  trackId: string;
  lineId: string;
  text: string;
  author: string;
  createdAt: number;
}

export interface PlaylistTrack extends Track {
  addedAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  /** True for the single reserved favourites list, which cannot be deleted. */
  favorite: boolean;
  tracks: PlaylistTrack[];
  createdAt: number;
}

export type ImportSource = 'deezer' | 'youtube' | 'text' | 'spotify';

export interface ImportRequest {
  source: ImportSource;
  /** Playlist URL for deezer/youtube/spotify. */
  url?: string;
  /** Raw "Artist — Title" lines, CSV, or exported JSON, for `text`. */
  body?: string;
  /** Target playlist; a new one is created when absent. */
  playlistId?: string;
  name?: string;
}

export interface ImportResponse {
  playlist: Playlist;
  imported: number;
  /** Entries that could not be parsed or matched, for honest reporting. */
  skipped: string[];
  source: ImportSource;
}

export interface PlaylistsResponse {
  playlists: Playlist[];
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
