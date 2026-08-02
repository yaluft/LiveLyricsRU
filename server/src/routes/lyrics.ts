import type { FastifyInstance } from 'fastify';
import type { Lyrics, Track } from '@lyrika/shared';
import { demoLyrics, findTrack } from '../data/catalog.js';
import { fetchLyrics } from '../services/lrclib.js';
import { fetchLyrics as fetchNeteaseLyrics } from '../services/netease.js';
import { asString, sendApiError } from './shared.js';

export function registerLyricsRoutes(app: FastifyInstance): void {
  app.get('/api/lyrics/:trackId', async (request, reply): Promise<Lyrics | void> => {
    const { trackId } = request.params as { trackId: string };
    const query = request.query as Record<string, unknown>;

    const known = findTrack(trackId);
    const track: Track = known ?? {
      id: trackId,
      title: asString(query.title, 'Без названия'),
      artist: asString(query.artist, ''),
      durationSec: Number(asString(query.duration, '0')) || 240,
      provider: 'youtube',
      providerId: trackId,
      hasSyncedLyrics: false,
    };

    if (track.artist) {
      try {
        const remote = await fetchLyrics(track);
        if (remote) return remote;
      } catch (error) {
        request.log.warn({ err: error }, 'lrclib lookup failed');
      }

      try {
        const netease = await fetchNeteaseLyrics(track);
        if (netease) return netease;
      } catch (error) {
        request.log.warn({ err: error }, 'netease lookup failed');
      }
    }

    const demo = demoLyrics(trackId);
    if (demo) return demo;

    return sendApiError(reply, 404, 'no_lyrics', 'Текст не найден ни в одной базе', 'Попробуйте ИИ-ассистента.');
  });
}
