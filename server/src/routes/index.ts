import type { FastifyInstance } from 'fastify';
import type {
  AiLyricRequest,
  Clip,
  FeedResponse,
  Lyrics,
  SavedLine,
  SavedWord,
  SearchResponse,
  StreamProvider,
  Track,
} from '@lyrika/shared';
import { CATALOG, demoLyrics, findTrack, searchCatalog } from '../data/catalog.js';
import { findArtist } from '../data/artists.js';
import { lookupWord } from '../data/dictionary.js';
import { SEED_CLIPS } from '../data/feed.js';
import { JsonStore } from '../lib/store.js';
import { fetchLyrics } from '../services/lrclib.js';
import { draftLyrics } from '../services/ai.js';
import {
  ResolveFailed,
  YtDlpUnavailable,
  resolveTrack,
  resolveUrl,
  searchTracks,
  ytDlpAvailable,
} from '../services/ytdlp.js';
import { looksLikeUrl } from '../services/urlGuard.js';

const words = new JsonStore<SavedWord[]>('vocabulary-words', []);
const lines = new JsonStore<SavedLine[]>('vocabulary-lines', []);
const clips = new JsonStore<Clip[]>('clips', []);

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const RESOLVABLE: StreamProvider[] = ['youtube', 'vk', 'spotify', 'demo'];

function isResolvable(value: string): value is StreamProvider {
  return (RESOLVABLE as string[]).includes(value);
}

/** The track the client is holding, when it is not one of ours. */
function trackFromBody(body: Record<string, unknown>): Track | null {
  const raw = body.track;
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const provider = asString(t.provider);
  const providerId = asString(t.providerId);
  if (!providerId || !isResolvable(provider)) return null;
  return {
    id: asString(t.id, `${provider}:${providerId}`),
    title: asString(t.title, 'Без названия'),
    artist: asString(t.artist),
    durationSec: asNumber(t.durationSec),
    provider,
    providerId,
    hasSyncedLyrics: t.hasSyncedLyrics === true,
  };
}

/** Last resort: ids are minted as `provider:providerId`, so parse one back. */
function trackFromId(trackId: string): Track | null {
  const separator = trackId.indexOf(':');
  if (separator <= 0) return null;
  const provider = trackId.slice(0, separator);
  const providerId = trackId.slice(separator + 1);
  if (!providerId || !isResolvable(provider)) return null;
  return {
    id: trackId,
    title: 'Без названия',
    artist: '',
    durationSec: 0,
    provider,
    providerId,
    hasSyncedLyrics: false,
  };
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async () => ({
    status: 'ok',
    ytDlp: await ytDlpAvailable(),
    catalogSize: CATALOG.length,
  }));

  app.get('/api/search', async (request, reply): Promise<SearchResponse | void> => {
    const query = asString((request.query as Record<string, unknown>).q).trim();
    if (!query) return { query, results: [], sampled: false };

    if (looksLikeUrl(query)) {
      try {
        const { track } = await resolveUrl(query);
        return { query, results: [track], sampled: false };
      } catch (error) {
        if (error instanceof ResolveFailed) {
          return reply.code(422).send({
            error: 'resolve_failed',
            message: error.message,
            hint: error.hint,
          });
        }
        if (!(error instanceof YtDlpUnavailable)) {
          request.log.warn({ err: error }, 'url search failed');
        }
        return reply.code(503).send({
          error: 'resolver_unavailable',
          message: 'Резолвер недоступен — yt-dlp не установлен',
          hint: 'Ищите по названию: работает демо-каталог.',
        });
      }
    }

    try {
      const results = await searchTracks(query);
      if (results.length) return { query, results, sampled: false };
    } catch (error) {
      if (!(error instanceof YtDlpUnavailable)) {
        request.log.warn({ err: error }, 'yt-dlp search failed');
      }
    }
    return { query, results: searchCatalog(query), sampled: true };
  });

  app.post('/api/resolve', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const trackId = asString(body.trackId);
    const url = asString(body.url);

    try {
      if (url) {
        const { track, stream } = await resolveUrl(url);
        return { track, stream };
      }
      // Search results come from yt-dlp, not the demo catalogue, so a catalogue
      // miss is normal — fall back to the track the client sent, then to the
      // `provider:providerId` encoded in the id itself.
      const track = findTrack(trackId) ?? trackFromBody(body) ?? trackFromId(trackId);
      if (!track) {
        return reply.code(404).send({
          error: 'unknown_track',
          message: 'Трек не найден',
          hint: 'Начните новый поиск.',
        });
      }
      const stream = await resolveTrack(track);
      return { track, stream };
    } catch (error) {
      if (error instanceof ResolveFailed) {
        return reply
          .code(422)
          .send({ error: 'resolve_failed', message: error.message, hint: error.hint });
      }
      if (error instanceof YtDlpUnavailable) {
        return reply.code(503).send({
          error: 'resolver_unavailable',
          message: 'yt-dlp не установлен на сервере',
          hint: 'Демо-треки играют без него.',
        });
      }
      request.log.error({ err: error }, 'resolve failed');
      return reply.code(502).send({
        error: 'resolve_failed',
        message: 'Не удалось получить поток',
        hint: 'Повторите попытку.',
      });
    }
  });

  app.get('/api/lyrics/:trackId', async (request, reply): Promise<Lyrics | void> => {
    const { trackId } = request.params as { trackId: string };
    const query = request.query as Record<string, unknown>;

    const known = findTrack(trackId);
    const track: Track = known ?? {
      id: trackId,
      title: asString(query.title, 'Без названия'),
      artist: asString(query.artist, ''),
      durationSec: Number(asString(query.duration, '0')) || 240,
      provider: 'youtube',
      providerId: trackId,
      hasSyncedLyrics: false,
    };

    if (track.artist) {
      try {
        const remote = await fetchLyrics(track);
        if (remote) return remote;
      } catch (error) {
        request.log.warn({ err: error }, 'lrclib lookup failed');
      }
    }

    const demo = demoLyrics(trackId);
    if (demo) return demo;

    return reply.code(404).send({
      error: 'no_lyrics',
      message: 'Текст не найден ни в одной базе',
      hint: 'Попробуйте ИИ-ассистента.',
    });
  });

  app.get('/api/artist', async (request) => {
    const name = asString((request.query as Record<string, unknown>).name);
    return findArtist(name);
  });

  app.get('/api/define', async (request, reply) => {
    const word = asString((request.query as Record<string, unknown>).word).trim();
    if (!word) {
      return reply.code(400).send({ error: 'bad_request', message: 'Не указано слово' });
    }
    return lookupWord(word);
  });

  app.post('/api/ai/lyrics', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const query = asString(body.query).trim();
    if (!query) {
      return reply.code(400).send({ error: 'bad_request', message: 'Не указан запрос' });
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
