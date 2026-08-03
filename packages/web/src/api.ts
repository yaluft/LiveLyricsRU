import type { ParsedLyrics, Track } from '@lyrika/core';

/**
 * Every API error is `{ error, message, hint? }`, with `message` and `hint`
 * written server-side as Russian user-facing strings. `hint` is the row's
 * fallback action — "try uploading a file" — and is what turns a dead end into
 * a next step.
 */
export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'ApiFailure';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { 'content-type': 'application/json' }
        : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let code = 'unknown';
    let message = `Ошибка ${response.status}`;
    let hint: string | undefined;
    try {
      const body = (await response.json()) as { error?: string; message?: string; hint?: string };
      code = body.error ?? code;
      message = body.message ?? message;
      hint = body.hint;
    } catch {
      // A non-JSON error body is still an error; keep the status-derived text.
    }
    throw new ApiFailure(response.status, code, message, hint);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface Health {
  status: string;
  version: number;
  ytDlp: boolean;
  dictionary: boolean;
  translation: boolean;
  hasTracks: boolean;
}

export interface StoredLyrics extends ParsedLyrics {
  trackId: string;
  sourceId: string;
  cached: boolean;
}

export interface Definition {
  word: string;
  romanised: string;
  lemma: string | null;
  senses: { pos: string; gloss: string; note?: string }[];
  found: boolean;
  dictionaryAvailable: boolean;
}

export interface VocabEntry {
  id: number;
  lemma: string;
  surfaceForm: string;
  trackId: string | null;
  note: string | null;
  addedAt: number;
  due: number | null;
  reps: number | null;
  lapses: number | null;
  state: number | null;
}

export interface ReviewCard {
  cardId: number;
  entryId: number;
  lemma: string;
  surfaceForm: string;
  trackId: string | null;
  due: number;
  state: number;
}

export interface LyricHit {
  trackId: string;
  title: string;
  artist: string;
  lineIdx: number;
  startMs: number | null;
  text: string;
}

export const api = {
  health: () => request<Health>('/health'),

  search: (q: string) => request<{ query: string; results: Track[] }>(`/search?q=${encodeURIComponent(q)}`),

  searchLyrics: (q: string) =>
    request<{ query: string; results: LyricHit[] }>(`/search/lyrics?q=${encodeURIComponent(q)}`),

  resolve: (track: Track) =>
    request<{ track: Track; stream: { url: string; provider: string } }>('/resolve', {
      method: 'POST',
      body: JSON.stringify({ trackId: track.id, track }),
    }),

  lyrics: (track: Track) => {
    const params = new URLSearchParams({
      title: track.title,
      artist: track.artist,
      duration: String(track.durationSec),
    });
    return request<StoredLyrics>(`/lyrics/${encodeURIComponent(track.id)}?${params}`);
  },

  translate: (trackId: string) =>
    request<{ enabled: boolean; targetLang: string; lines: { idx: number; text: string | null }[] }>(
      `/translate/${encodeURIComponent(trackId)}`,
      { method: 'POST', body: JSON.stringify({ targetLang: 'en' }) },
    ),

  define: (word: string) => request<Definition>(`/define?word=${encodeURIComponent(word)}`),

  upload: (form: FormData) =>
    request<{ track: Track; lyrics: { timingKind: string; lineCount: number } | null }>('/uploads', {
      method: 'POST',
      body: form,
    }),

  vocabulary: () => request<{ words: VocabEntry[]; due: number }>('/vocabulary'),

  saveWord: (body: { lemma: string; surfaceForm: string; trackId?: string | null }) =>
    request<{ entry: VocabEntry }>('/vocabulary', { method: 'POST', body: JSON.stringify(body) }),

  removeWord: (id: number) => request<void>(`/vocabulary/${id}`, { method: 'DELETE' }),

  reviewQueue: () => request<{ cards: ReviewCard[] }>('/review'),

  grade: (cardId: number, rating: 1 | 2 | 3 | 4) =>
    request<{ cardId: number; due: number; scheduledDays: number; state: number }>(
      `/review/${cardId}`,
      { method: 'POST', body: JSON.stringify({ rating }) },
    ),
};
