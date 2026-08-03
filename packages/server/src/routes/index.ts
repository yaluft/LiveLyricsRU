import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { tracks } from '../db/schema.js';
import { dictionaryAvailable } from '../services/dictionary.js';
import { ytDlpAvailable } from '../services/ytdlp.js';
import { languageRoutes } from './language.js';
import { lyricsRoutes } from './lyrics.js';
import { resolveRoutes } from './resolve.js';
import { searchRoutes } from './search.js';
import { streamRoutes } from './stream.js';
import { uploadRoutes } from './uploads.js';
import { vocabularyRoutes } from './vocabulary.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    const [row] = await getDb().select({ id: tracks.id }).from(tracks).limit(1);

    return {
      status: 'ok' as const,
      version: 3,
      // All three are reported, none are required. Without the resolver, upload
      // still works; without the dictionary, lookups return a romanisation
      // only; without an API key, the translation row is simply absent.
      ytDlp: await ytDlpAvailable(),
      dictionary: dictionaryAvailable(),
      translation: config.anthropicApiKey !== '',
      hasTracks: row !== undefined,
    };
  });

  await app.register(uploadRoutes);
  await app.register(streamRoutes);
  await app.register(searchRoutes);
  await app.register(resolveRoutes);
  await app.register(lyricsRoutes);
  await app.register(languageRoutes);
  await app.register(vocabularyRoutes);
}
