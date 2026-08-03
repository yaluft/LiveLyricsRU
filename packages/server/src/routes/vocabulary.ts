import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import {
  dueCards,
  dueCount,
  isReviewRating,
  listVocabulary,
  removeWord,
  reviewCard,
  saveWord,
} from '../services/srs.js';

interface SaveBody {
  lemma?: string;
  surfaceForm?: string;
  trackId?: string | null;
  lineId?: number | null;
  note?: string | null;
}

export async function vocabularyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/vocabulary', async () => ({
    words: await listVocabulary(getDb()),
    due: await dueCount(getDb()),
  }));

  app.post<{ Body: SaveBody }>('/vocabulary', async (request, reply) => {
    const { lemma, surfaceForm } = request.body ?? {};
    const word = (lemma ?? surfaceForm ?? '').trim();
    if (!word) {
      return reply.code(400).send({ error: 'empty_word', message: 'Не передано слово' });
    }

    const entry = await saveWord(getDb(), {
      lemma: word,
      surfaceForm: (surfaceForm ?? word).trim(),
      trackId: request.body?.trackId ?? null,
      lineId: request.body?.lineId ?? null,
      note: request.body?.note ?? null,
    });

    return reply.code(201).send({ entry });
  });

  app.delete<{ Params: { id: string } }>('/vocabulary/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id)) {
      return reply.code(400).send({ error: 'bad_id', message: 'Неверный идентификатор' });
    }

    await removeWord(getDb(), id);
    return reply.code(204).send();
  });

  /** The review queue — what v2's inert "Учить" button was supposed to open. */
  app.get<{ Querystring: { limit?: string } }>('/review', async (request) => {
    const limit = Math.min(Math.max(Number(request.query.limit) || 20, 1), 100);
    return { cards: await dueCards(getDb(), limit) };
  });

  app.post<{ Params: { cardId: string }; Body: { rating?: number; durationMs?: number } }>(
    '/review/:cardId',
    async (request, reply) => {
      const cardId = Number(request.params.cardId);
      const rating = Number(request.body?.rating);

      if (!Number.isInteger(cardId)) {
        return reply.code(400).send({ error: 'bad_id', message: 'Неверный идентификатор' });
      }
      if (!isReviewRating(rating)) {
        return reply.code(400).send({
          error: 'bad_rating',
          message: 'Оценка должна быть от 1 до 4',
          hint: '1 — снова, 2 — трудно, 3 — хорошо, 4 — легко.',
        });
      }

      const result = await reviewCard(getDb(), cardId, rating, request.body?.durationMs);
      if (!result) {
        return reply.code(404).send({ error: 'unknown_card', message: 'Карточка не найдена' });
      }

      return result;
    },
  );
}
