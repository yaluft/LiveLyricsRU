import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { tracks } from '../db/schema.js';
import { ytDlpAvailable } from '../services/ytdlp.js';
import { streamRoutes } from './stream.js';
import { uploadRoutes } from './uploads.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    const [row] = await getDb().select({ id: tracks.id }).from(tracks).limit(1);

    return {
      status: 'ok' as const,
      version: 3,
      // Reported, never required. Without the resolver the app still works end
      // to end through upload, which is the whole point of having both.
      ytDlp: await ytDlpAvailable(),
      dictionary: false,
      translation: config.anthropicApiKey !== '',
      hasTracks: row !== undefined,
    };
  });

  await app.register(uploadRoutes);
  await app.register(streamRoutes);
}
