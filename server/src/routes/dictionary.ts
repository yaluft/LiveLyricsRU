import type { FastifyInstance } from 'fastify';
import { lookupWord } from '../data/dictionary.js';
import { asString, sendApiError } from './shared.js';

export function registerDictionaryRoutes(app: FastifyInstance): void {
  app.get('/api/define', async (request, reply) => {
    const word = asString((request.query as Record<string, unknown>).word).trim();
    if (!word) {
      return sendApiError(reply, 400, 'bad_request', 'Не указано слово');
    }
    return lookupWord(word);
  });
}
