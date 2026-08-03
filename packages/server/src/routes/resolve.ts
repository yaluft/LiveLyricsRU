import type { FastifyInstance } from 'fastify';
import { trackFromId, type Track } from '@lyrika/core';
import { getDb } from '../db/index.js';
import { getStream } from '../services/streamCache.js';
import { findTrack, rememberTrack } from '../services/tracks.js';
import { ResolveFailed, ResolverUnavailable, resolveUrl } from '../services/ytdlp.js';

interface ResolveBody {
  trackId?: string;
  url?: string;
  track?: Track;
}

export async function resolveRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Turns a track reference into something playable.
   *
   * The returned `stream.url` is always `/api/stream/:trackId` — never the
   * upstream URL, which is IP-bound and CORS-less and would fail in the browser
   * even if leaking it were acceptable.
   */
  app.post<{ Body: ResolveBody }>('/resolve', async (request, reply) => {
    const db = getDb();
    const { trackId, url, track: supplied } = request.body ?? {};

    try {
      let track: Track | null = null;

      if (url) {
        track = await resolveUrl(url);
      } else if (trackId) {
        // Three tiers, in order of trustworthiness: what we stored, what the
        // client sent, and finally the id string itself. Search results come
        // from the resolver rather than a local table, so a database miss is
        // the normal case rather than a failure.
        track = (await findTrack(db, trackId)) ?? supplied ?? trackFromId(trackId);
      } else if (supplied) {
        track = supplied;
      }

      if (!track) {
        return reply.code(400).send({
          error: 'bad_request',
          message: 'Нужен trackId или url',
        });
      }

      await rememberTrack(db, track);

      // Uploads are already local; resolving warms the cache for remote ones so
      // the first range request does not pay for a cold yt-dlp run.
      if (track.provider !== 'upload') {
        await getStream(track);
      }

      return {
        track,
        stream: { url: `/api/stream/${encodeURIComponent(track.id)}`, provider: track.provider },
      };
    } catch (error) {
      if (error instanceof ResolverUnavailable) {
        return reply.code(503).send({
          error: 'resolver_unavailable',
          message: 'Резолвер недоступен',
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
}
