import type { FastifyInstance } from 'fastify';
import type { AiLyricRequest } from '@lyrika/shared';
import { draftLyrics } from '../services/ai.js';
import { asNumber, asString, sendApiError } from './shared.js';

export function registerAiRoutes(app: FastifyInstance): void {
  app.post('/api/ai/lyrics', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const query = asString(body.query).trim();
    if (!query) {
      return sendApiError(reply, 400, 'bad_request', 'Не указан запрос');
    }
    const draft: AiLyricRequest = {
      query,
      ...(typeof body.trackId === 'string' ? { trackId: body.trackId } : {}),
      withTranslit: body.withTranslit !== false,
      withTranslation: body.withTranslation !== false,
    };
    const duration = asNumber(body.durationSec, 240);
    return draftLyrics(draft, duration);
  });
}
