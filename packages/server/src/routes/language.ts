import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { define, dictionaryAvailable } from '../services/dictionary.js';
import { loadLyrics } from '../services/lyrics.js';
import { lineHash, translateLines, translationEnabled } from '../services/translate.js';

export async function languageRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Always answers, even on a miss — an unknown word still gets its
   * romanisation, because the pronunciation is useful on its own and an empty
   * card reads as a bug rather than as "not in the dictionary".
   */
  app.get<{ Querystring: { word?: string } }>('/define', async (request, reply) => {
    const word = (request.query.word ?? '').trim();
    if (!word) {
      return reply.code(400).send({ error: 'empty_word', message: 'Не передано слово' });
    }

    return { ...(await define(word)), dictionaryAvailable: dictionaryAvailable() };
  });

  /**
   * Translations for a track's lines, keyed by line hash so the client can map
   * them onto whatever it is displaying.
   *
   * With no API key this returns whatever is already cached and reports
   * `enabled: false`; the client then hides the translation row entirely rather
   * than printing "unavailable" under every line.
   */
  app.post<{ Params: { trackId: string }; Body: { targetLang?: string } }>(
    '/translate/:trackId',
    async (request, reply) => {
      const db = getDb();
      const stored = await loadLyrics(db, request.params.trackId);

      if (!stored) {
        return reply.code(404).send({ error: 'no_lyrics', message: 'Текст не найден' });
      }

      const targetLang = request.body?.targetLang ?? 'en';
      const texts = stored.lines.map((line) => line.text);
      const byHash = await translateLines(db, texts, targetLang);

      return {
        enabled: translationEnabled(),
        targetLang,
        // Indexed by line so the client does not have to re-hash anything.
        lines: stored.lines.map((line) => ({
          idx: line.idx,
          text: byHash.get(lineHash(line.text)) ?? null,
        })),
      };
    },
  );
}
