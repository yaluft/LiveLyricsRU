import type { FastifyInstance } from 'fastify';
import { trackFromId } from '@lyrika/core';
import { getDb } from '../db/index.js';
import { fetchFromLrclib } from '../services/providers/lrclib.js';
import { fetchFromNetease } from '../services/providers/netease.js';
import { loadLyrics, saveLyrics } from '../services/lyrics.js';
import { findTrack } from '../services/tracks.js';

interface Query {
  title?: string;
  artist?: string;
  duration?: string;
  refresh?: string;
}

export async function lyricsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Cache first, then LRCLIB, then NetEase, then a 404 that says so.
   *
   * The cache is permanent rather than time-boxed: lyrics for a given recording
   * do not change, and a third-party provider disappearing should not take the
   * text with it. `?refresh=1` forces a refetch when a better source appears.
   */
  app.get<{ Params: { trackId: string }; Querystring: Query }>(
    '/lyrics/:trackId',
    async (request, reply) => {
      const db = getDb();
      const { trackId } = request.params;

      if (request.query.refresh !== '1') {
        const cached = await loadLyrics(db, trackId);
        if (cached) return { trackId, cached: true, ...cached };
      }

      const stored = await findTrack(db, trackId);
      const fallback = trackFromId(trackId);
      const title = request.query.title ?? stored?.title ?? fallback?.title ?? '';
      const artist = request.query.artist ?? stored?.artist ?? '';
      const duration = Number(request.query.duration) || stored?.durationSec || 0;

      // Remote lookups need an artist to disambiguate; searching on a title
      // alone reliably returns a different song, and wrong lyrics in perfect
      // sync are worse than none.
      const found = artist
        ? ((await fetchFromLrclib(title, artist, duration)) ??
          (await fetchFromNetease(title, artist, duration)))
        : null;

      if (!found) {
        return reply.code(404).send({
          error: 'no_lyrics',
          message: 'Текст не найден',
          hint: 'Загрузите файл вместе с .lrc, чтобы добавить свой текст.',
        });
      }

      const saved = await saveLyrics(db, trackId, found.sourceId, found.raw);
      return { trackId, cached: false, ...saved };
    },
  );
}
