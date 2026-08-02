import type {
  AiExplainResponse,
  AiLyricResponse,
  ArtistProfile,
  Clip,
  FeedResponse,
  ImportRequest,
  ImportResponse,
  Lyrics,
  Playlist,
  PlaylistsResponse,
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

  aiExplain: (payload: {
    text: string;
    trackTitle?: string;
    artist?: string;
    context?: string[];
  }) =>
    request<AiExplainResponse>('/api/ai/explain', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** Save lyrics the user pasted; beats every remote source for this track. */
  saveCustomLyrics: (payload: {
    trackId: string;
    body: string;
    durationSec?: number;
    title?: string;
    artist?: string;
  }) =>
    request<Lyrics>('/api/lyrics/custom', { method: 'POST', body: JSON.stringify(payload) }),

  deleteCustomLyrics: (trackId: string) =>
    request<{ ok: true }>(`/api/lyrics/custom/${encodeURIComponent(trackId)}`, {
      method: 'DELETE',
    }),

  playlists: () => request<PlaylistsResponse>('/api/playlists'),

  createPlaylist: (name: string) =>
    request<{ playlist: Playlist; playlists: Playlist[] }>('/api/playlists', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  deletePlaylist: (id: string) =>
    request<PlaylistsResponse>(`/api/playlists/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  addToPlaylist: (id: string, track: Track) =>
    request<{ playlist: Playlist; playlists: Playlist[] }>(
      `/api/playlists/${encodeURIComponent(id)}/tracks`,
      { method: 'POST', body: JSON.stringify({ track }) },
    ),

  removeFromPlaylist: (id: string, trackId: string) =>
    request<{ playlist: Playlist; playlists: Playlist[] }>(
      `/api/playlists/${encodeURIComponent(id)}/tracks/${encodeURIComponent(trackId)}`,
      { method: 'DELETE' },
    ),

  /** Toggles the track in the reserved favourites list. */
  toggleFavorite: (track: Track) =>
    request<{ playlist: Playlist; playlists: Playlist[]; favorited: boolean }>(
      '/api/playlists/favorites/toggle',
      { method: 'POST', body: JSON.stringify({ track }) },
    ),

  importPlaylist: (payload: ImportRequest) =>
    request<ImportResponse>('/api/import', { method: 'POST', body: JSON.stringify(payload) }),

  feed: () => request<FeedResponse>('/api/feed'),

  publishClip: (payload: Omit<Clip, 'id' | 'author' | 'likes' | 'createdAt'>) =>
    request<{ clip: Clip; clips: Clip[] }>('/api/clips', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
