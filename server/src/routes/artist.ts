import type { FastifyInstance } from 'fastify';
import { findArtist } from '../data/artists.js';
import { asString } from './shared.js';

export function registerArtistRoutes(app: FastifyInstance): void {
  app.get('/api/artist', async (request) => {
    const name = asString((request.query as Record<string, unknown>).name);
    return findArtist(name);
  });
}
