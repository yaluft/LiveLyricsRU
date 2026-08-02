import type { FastifyInstance } from 'fastify';
import { registerHealthRoutes } from './health.js';
import { registerSearchRoutes } from './search.js';
import { registerLyricsRoutes } from './lyrics.js';
import { registerArtistRoutes } from './artist.js';
import { registerDictionaryRoutes } from './dictionary.js';
import { registerAiRoutes } from './ai.js';
import { registerVocabularyRoutes } from './vocabulary.js';
import { registerClipsRoutes } from './clips.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  registerHealthRoutes(app);
  registerSearchRoutes(app);
  registerLyricsRoutes(app);
  registerArtistRoutes(app);
  registerDictionaryRoutes(app);
  registerAiRoutes(app);
  registerVocabularyRoutes(app);
  registerClipsRoutes(app);
}
