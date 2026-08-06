import type {
  AiLyricResponse,
  ArtistProfile,
  Clip,
  FeedResponse,
  Lyrics,
  ResolvedStream,
  SavedLine,
  SavedWord,
  SearchResponse,
  Track,
  WordDefinition,
} from '@lyrika/shared';

export class ApiFailure extends Error {
  readonly status: number;
  readonly hint: string | undefined;

  constructor(status: number, message: string, hint?: string) {
    super(message);
    this.name = 'ApiFailure';
    this.status = status;
    this.hint = hint;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
    });
  } catch {
    throw new ApiFailure(0, 'Сервер недоступен', 'Проверьте, запущен ли API.');
  }

  if (!res.ok) {
    let message = `Ошибка ${res.status}`;
    let hint: string | undefined;
    try {
      const body = (await res.json()) as { message?: string; hint?: string };
      if (body.message) message = body.message;
      hint = body.hint;
    } catch {
      // Non-JSON error body: keep the status-derived message.
    }
    throw new ApiFailure(res.status, message, hint);
  }
  return (await res.json()) as T;
}

export const api = {
  search: (query: string) =>
    request<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}`),

  resolve: (payload: { trackId?: string; url?: string; track?: Track }) =>
    request<{ track: Track; stream: ResolvedStream }>('/api/resolve', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  lyrics: (track: Track) => {
    const params = new URLSearchParams({
      title: track.title,
      artist: track.artist,
      duration: String(track.durationSec),
    });
    return request<Lyrics>(`/api/lyrics/${encodeURIComponent(track.id)}?${params}`);
  },

  saveCustomLyrics: (payload: {
    trackId: string;
    lrc: string;
    durationSec?: number;
  }) =>
    request<Lyrics>('/api/lyrics/custom', { method: 'POST', body: JSON.stringify(payload) }),

  artist: (name: string) => request<ArtistProfile>(`/api/artist?name=${encodeURIComponent(name)}`),

  define: (word: string) => request<WordDefinition>(`/api/define?word=${encodeURIComponent(word)}`),

  aiLyrics: (payload: {
    query: string;
    trackId?: string;
    durationSec?: number;
    withTranslit?: boolean;
    withTranslation?: boolean;
  }) =>
    request<AiLyricResponse>('/api/ai/lyrics', { method: 'POST', body: JSON.stringify(payload) }),

  vocabulary: () => request<{ words: SavedWord[]; lines: SavedLine[] }>('/api/vocabulary'),

  saveWord: (payload: Omit<SavedWord, 'id' | 'savedAt' | 'seenCount'>) =>
    request<{ words: SavedWord[] }>('/api/vocabulary/words', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteWord: (id: string) =>
    request<{ words: SavedWord[] }>(`/api/vocabulary/words/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  saveLine: (payload: Omit<SavedLine, 'id' | 'savedAt'>) =>
    request<{ lines: SavedLine[] }>('/api/vocabulary/lines', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteLine: (id: string) =>
    request<{ lines: SavedLine[] }>(`/api/vocabulary/lines/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  feed: () => request<FeedResponse>('/api/feed'),

  publishClip: (payload: Omit<Clip, 'id' | 'author' | 'likes' | 'createdAt'>) =>
    request<{ clip: Clip; clips: Clip[] }>('/api/clips', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
