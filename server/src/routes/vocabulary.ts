import type { FastifyInstance } from 'fastify';
import type { SavedLine, SavedWord } from '@lyrika/shared';
import { JsonStore } from '../lib/store.js';
import { asNumber, asString, id } from './shared.js';

const words = new JsonStore<SavedWord[]>('vocabulary-words', []);
const lines = new JsonStore<SavedLine[]>('vocabulary-lines', []);

export function registerVocabularyRoutes(app: FastifyInstance): void {
  app.get('/api/vocabulary', async () => ({
    words: await words.read(),
    lines: await lines.read(),
  }));

  app.post('/api/vocabulary/words', async (request) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const word = asString(body.word).trim();
    const next = await words.update((current) => {
      const existing = current.find(
        (w) => w.word.toLowerCase() === word.toLowerCase() && w.trackId === asString(body.trackId),
      );
      if (existing) {
        return current.map((w) =>
          w.id === existing.id ? { ...w, seenCount: w.seenCount + 1 } : w,
        );
      }
      const entry: SavedWord = {
        id: id('w'),
        word,
        translit: asString(body.translit),
        gloss: asString(body.gloss),
        trackId: asString(body.trackId),
        trackTitle: asString(body.trackTitle),
        atSec: asNumber(body.atSec),
        seenCount: 1,
        savedAt: Date.now(),
      };
      return [entry, ...current];
    });
    return { words: next };
  });

  app.delete('/api/vocabulary/words/:id', async (request) => {
    const { id: wordId } = request.params as { id: string };
    const next = await words.update((current) => current.filter((w) => w.id !== wordId));
    return { words: next };
  });

  app.post('/api/vocabulary/lines', async (request) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const entry: SavedLine = {
      id: id('ln'),
      text: asString(body.text),
      translation: asString(body.translation),
      trackId: asString(body.trackId),
      trackTitle: asString(body.trackTitle),
      startSec: asNumber(body.startSec),
      endSec: asNumber(body.endSec),
      savedAt: Date.now(),
    };
    const next = await lines.update((current) => [entry, ...current]);
    return { lines: next };
  });

  app.delete('/api/vocabulary/lines/:id', async (request) => {
    const { id: lineId } = request.params as { id: string };
    const next = await lines.update((current) => current.filter((l) => l.id !== lineId));
    return { lines: next };
  });
}
