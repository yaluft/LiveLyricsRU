import type { FastifyInstance } from 'fastify';
import type { Clip, FeedResponse } from '@lyrika/shared';
import { SEED_CLIPS } from '../data/feed.js';
import { JsonStore } from '../lib/store.js';
import { asNumber, asString, id } from './shared.js';

const clips = new JsonStore<Clip[]>('clips', []);

export function registerClipsRoutes(app: FastifyInstance): void {
  app.get('/api/feed', async (): Promise<FeedResponse> => {
    const mine = await clips.read();
    return { clips: [...mine, ...SEED_CLIPS], simulated: true };
  });

  app.post('/api/clips', async (request) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const show = (body.show ?? {}) as Record<string, unknown>;
    const clip: Clip = {
      id: id('clip'),
      trackId: asString(body.trackId),
      trackTitle: asString(body.trackTitle),
      artist: asString(body.artist),
      startSec: asNumber(body.startSec),
      endSec: asNumber(body.endSec),
      lineText: asString(body.lineText),
      translit: asString(body.translit),
      translation: asString(body.translation),
      show: {
        translit: show.translit !== false,
        translation: show.translation !== false,
        waves: show.waves === true,
        artwork: show.artwork === true,
      },
      author: '@вы',
      likes: 0,
      createdAt: Date.now(),
    };
    const next = await clips.update((current) => [clip, ...current]);
    return { clip, clips: next };
  });

  app.delete('/api/clips/:id', async (request) => {
    const { id: clipId } = request.params as { id: string };
    const next = await clips.update((current) => current.filter((c) => c.id !== clipId));
    return { clips: next };
  });
}
