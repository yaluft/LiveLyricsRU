import type { Lyrics, ResolvedStream, Track, WordDefinition } from '@lyrika/shared';

/**
 * Trimmed port of the real client/src/api.ts — only the three endpoints this
 * spike touches (resolve, lyrics, define). Same shape (`{ error, message,
 * hint? }` on failure) so a real port would keep this file nearly as-is.
 */
export class ApiFailure extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiFailure';
    this.status = status;
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
    throw new ApiFailure(0, 'Сервер недоступен');
  }
  if (!res.ok) {
    let message = `Ошибка ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Non-JSON error body: keep the status-derived message.
    }
    throw new ApiFailure(res.status, message);
  }
  return (await res.json()) as T;
}

export const api = {
  resolve: (trackId: string) =>
    request<{ track: Track; stream: ResolvedStream }>('/api/resolve', {
      method: 'POST',
      body: JSON.stringify({ trackId }),
    }),

  lyrics: (track: Track) => {
    const params = new URLSearchParams({
      title: track.title,
      artist: track.artist,
      duration: String(track.durationSec),
    });
    return request<Lyrics>(`/api/lyrics/${encodeURIComponent(track.id)}?${params}`);
  },

  define: (word: string) => request<WordDefinition>(`/api/define?word=${encodeURIComponent(word)}`),
};
