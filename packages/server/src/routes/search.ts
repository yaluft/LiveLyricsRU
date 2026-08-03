import type { FastifyInstance } from 'fastify';
import type { Track } from '@lyrika/core';
import { getDb } from '../db/index.js';
import { rememberTrack, rememberTracks } from '../services/tracks.js';
import { searchLyricLines } from '../services/lyricSearch.js';
import { looksLikeUrl } from '../services/urlGuard.js';
import {
  ResolveFailed,
  ResolverUnavailable,
  resolveUrl,
  searchTracks,
} from '../services/ytdlp.js';

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  /**
   * A pasted URL and a typed query arrive through the same field, because that
   * is how people actually use it. A URL resolves to exactly one track; a term
   * goes to the resolver's search.
   */
  app.get<{ Querystring: { q?: string } }>('/search', async (request, reply) => {
    const query = (request.query.q ?? '').trim();
    if (!query) {
      return reply.code(400).send({ error: 'empty_query', message: 'Пустой запрос' });
    }

    const db = getDb();

    try {
      if (looksLikeUrl(query)) {
        const track = await resolveUrl(query);
        await rememberTrack(db, track);
        return { query, results: [track] satisfies Track[] };
      }

      const results = await searchTracks(query);
      await rememberTracks(db, results);
      return { query, results };
    } catch (error) {
      if (error instanceof ResolverUnavailable) {
        return reply.code(503).send({
          error: 'resolver_unavailable',
          message: 'Поиск недоступен: yt-dlp не установлен',
          hint: 'Загрузите файл со своего устройства.',
        });
      }
      if (error instanceof ResolveFailed) {
        return reply.code(422).send({
          error: 'resolve_failed',
          message: error.message,
          ...(error.hint ? { hint: error.hint } : {}),
        });
      }
      throw error;
    }
  });

  /**
   * Full-text search across every lyric line ever fetched — "find the song with
   * this line". Works entirely offline, over whatever the cache has seen.
   */
  app.get<{ Querystring: { q?: string; limit?: string } }>('/search/lyrics', async (request, reply) => {
    const query = (request.query.q ?? '').trim();
    if (!query) {
      return reply.code(400).send({ error: 'empty_query', message: 'Пустой запрос' });
    }

    const limit = Math.min(Math.max(Number(request.query.limit) || 20, 1), 100);
    return { query, results: await searchLyricLines(getDb(), query, limit) };
  });
}
