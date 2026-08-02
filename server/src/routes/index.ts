import { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import type {
  AiExplainRequest,
  AiExplainResponse,
  AiLyricRequest,
  Clip,
  FeedResponse,
  ImportRequest,
  ImportResponse,
  Lyrics,
  LyricsSaveRequest,
  ResolvedStream,
  SavedLine,
  SavedWord,
  SearchResponse,
  StreamProvider,
  Track,
} from '@lyrika/shared';
import { CATALOG, findTrack, searchCatalog } from '../data/catalog.js';
import { findArtist } from '../data/artists.js';
import { lookupWord } from '../data/dictionary.js';
import { SEED_CLIPS } from '../data/feed.js';
import { JsonStore } from '../lib/store.js';
import { draftLyrics } from '../services/ai.js';
import { explainLine, claudeAvailable } from '../services/claude.js';
import {
  originalLyricsForCompare,
  removeLyrics,
  resolveLyrics,
  saveLyrics,
} from '../services/lyrics.js';
import {
  addTrack,
  addTracks,
  createPlaylist,
  deletePlaylist,
  listPlaylists,
  removeTrack,
  toggleFavorite,
} from '../services/playlists.js';
import {
  ImportUnavailable,
  importFromDeezer,
  importFromSpotify,
  importFromText,
  importFromYoutube,
} from '../services/playlistImport.js';
import {
  ResolveFailed,
  YtDlpUnavailable,
  resolveTrack,
  resolveUrl,
  searchTracks,
  ytDlpAvailable,
} from '../services/ytdlp.js';
import { looksLikeUrl } from '../services/urlGuard.js';

/**
 * yt-dlp hands back a direct googlevideo/VK CDN URL, but those are commonly
 * bound to the IP that requested them and carry no CORS headers, so a browser
 * fetching them straight from the client fails unpredictably. Every stream is
 * proxied through this server instead: the client always gets a same-origin
 * `/api/stream/:trackId` URL, and the real CDN URL is cached briefly here so
 * repeat range requests (seeking) don't re-invoke yt-dlp each time.
 */
const STREAM_CACHE_TTL_MS = 5 * 60 * 1000;
const STREAM_CACHE = new Map<string, { url: string; mimeType: string; expiresAt: number }>();
// Coalesces concurrent range requests for the same cold trackId so a media
// element's simultaneous buffering requests don't spawn duplicate yt-dlp runs.
const STREAM_INFLIGHT = new Map<string, Promise<ResolvedStream>>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of STREAM_CACHE) {
    if (entry.expiresAt < now) STREAM_CACHE.delete(key);
  }
}, STREAM_CACHE_TTL_MS).unref();

function cacheStream(trackId: string, url: string, mimeType: string): void {
  STREAM_CACHE.set(trackId, { url, mimeType, expiresAt: Date.now() + STREAM_CACHE_TTL_MS });
}

function proxyStreamUrl(trackId: string): string {
  return `/api/stream/${encodeURIComponent(trackId)}`;
}

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
        const { track, stream } = await resolveUrl(query);
        cacheStream(track.id, stream.url, stream.mimeType);
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
        cacheStream(track.id, stream.url, stream.mimeType);
        return { track, stream: { ...stream, url: proxyStreamUrl(track.id) } };
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
      cacheStream(track.id, stream.url, stream.mimeType);
      return { track, stream: { ...stream, url: proxyStreamUrl(track.id) } };
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

  app.get('/api/stream/:trackId', async (request, reply) => {
    // Fastify's router already decodes route params; decoding again corrupts
    // (or throws on) ids that contain a literal `%`.
    const trackId = (request.params as { trackId: string }).trackId;

    let cached = STREAM_CACHE.get(trackId);
    if (!cached || cached.expiresAt < Date.now()) {
      const track = findTrack(trackId) ?? trackFromId(trackId);
      if (!track) {
        return reply.code(404).send({ error: 'unknown_track', message: 'Трек не найден' });
      }
      try {
        let pending = STREAM_INFLIGHT.get(trackId);
        if (!pending) {
          pending = resolveTrack(track).finally(() => STREAM_INFLIGHT.delete(trackId));
          STREAM_INFLIGHT.set(trackId, pending);
        }
        const stream = await pending;
        cacheStream(trackId, stream.url, stream.mimeType);
        cached = STREAM_CACHE.get(trackId);
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
          });
        }
        request.log.error({ err: error }, 'stream resolve failed');
        return reply.code(502).send({ error: 'resolve_failed', message: 'Не удалось получить поток' });
      }
    }
    if (!cached) {
      return reply.code(502).send({ error: 'resolve_failed', message: 'Не удалось получить поток' });
    }

    const range = request.headers.range;
    let upstream: Response;
    try {
      upstream = await fetch(cached.url, range ? { headers: { range } } : undefined);
    } catch (error) {
      request.log.error({ err: error }, 'stream upstream fetch failed');
      return reply.code(502).send({ error: 'stream_failed', message: 'Источник недоступен' });
    }

    if (upstream.status === 416) {
      // A genuinely out-of-range seek — the cached URL is still good, only
      // this particular range is invalid, so don't evict it.
      reply.code(416);
      const contentRange = upstream.headers.get('content-range');
      if (contentRange) reply.header('Content-Range', contentRange);
      return reply.send();
    }

    if (!upstream.ok) {
      // 403/404/410-style failures mean the CDN URL itself is stale
      // (expired/IP-bound); drop it so the next request re-resolves via
      // yt-dlp instead of repeating the same failure against a dead URL.
      if ([403, 404, 410].includes(upstream.status)) {
        STREAM_CACHE.delete(trackId);
      }
      request.log.warn({ status: upstream.status, trackId }, 'stream upstream returned non-ok');
      return reply.code(502).send({ error: 'stream_failed', message: 'Источник недоступен' });
    }

    reply.code(upstream.status);
    reply.header('Content-Type', cached.mimeType);
    // Announced on the plain 200 too, not just on 206: a media element that
    // opens without a Range header reads the absence of this as "no seeking",
    // which breaks scrubbing and the A–B/line loops that depend on it.
    reply.header('Accept-Ranges', 'bytes');
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) reply.header('Content-Range', contentRange);
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) reply.header('Content-Length', contentLength);

    return reply.send(upstream.body ? Readable.fromWeb(upstream.body as never) : null);
  });

  app.get('/api/lyrics/:trackId', async (request, reply): Promise<Lyrics | void> => {
    const { trackId } = request.params as { trackId: string };
    const query = request.query as Record<string, unknown>;
    const translate =
      asString(query.translate) === '1' ||
      asString(query.translate).toLowerCase() === 'true';

    const lyrics = await resolveLyrics(
      trackId,
      {
        title: asString(query.title),
        artist: asString(query.artist),
        duration: asString(query.duration),
      },
      { translate },
    );

    if (lyrics) return lyrics;

    return reply.code(404).send({
      error: 'no_lyrics',
      message: 'Текст не найден ни в одной базе',
      hint: 'Вставьте свой текст или попробуйте ИИ-ассистента.',
    });
  });

  app.get('/api/lyrics/:trackId/original', async (request, reply): Promise<Lyrics | void> => {
    const { trackId } = request.params as { trackId: string };
    const original = await originalLyricsForCompare(trackId);
    if (original) return original;
    return reply.code(404).send({
      error: 'no_original',
      message: 'Исходный текст не сохранён',
      hint: 'Сравнение доступно только после правки текста.',
    });
  });

  app.put('/api/lyrics/:trackId', async (request, reply): Promise<Lyrics | void> => {
    const { trackId } = request.params as { trackId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const req: LyricsSaveRequest = {
      trackId,
      body: asString(body.body),
      ...(typeof body.durationSec === 'number' ? { durationSec: body.durationSec } : {}),
      ...(typeof body.title === 'string' ? { title: body.title } : {}),
      ...(typeof body.artist === 'string' ? { artist: body.artist } : {}),
    };
    try {
      return await saveLyrics(req);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось сохранить текст';
      return reply.code(400).send({ error: 'bad_request', message });
    }
  });

  /** Legacy alias — older clients POST here instead of PUT. */
  app.post('/api/lyrics/custom', async (request, reply): Promise<Lyrics | void> => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const trackId = asString(body.trackId);
    if (!trackId) {
      return reply.code(400).send({ error: 'bad_request', message: 'Не указан trackId' });
    }
    const req: LyricsSaveRequest = {
      trackId,
      body: asString(body.body),
      ...(typeof body.durationSec === 'number' ? { durationSec: body.durationSec } : {}),
      ...(typeof body.title === 'string' ? { title: body.title } : {}),
      ...(typeof body.artist === 'string' ? { artist: body.artist } : {}),
    };
    try {
      return await saveLyrics(req);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось сохранить текст';
      return reply.code(400).send({ error: 'bad_request', message });
    }
  });

  app.delete('/api/lyrics/:trackId', async (request) => {
    const { trackId } = request.params as { trackId: string };
    await removeLyrics(trackId);
    return { ok: true as const };
  });

  app.delete('/api/lyrics/custom/:trackId', async (request) => {
    const { trackId } = request.params as { trackId: string };
    await removeLyrics(trackId);
    return { ok: true as const };
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

  app.post('/api/ai/explain', async (request, reply): Promise<AiExplainResponse | void> => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const text = asString(body.text).trim();
    if (!text) {
      return reply.code(400).send({ error: 'bad_request', message: 'Не указана строка' });
    }
    const req: AiExplainRequest = {
      text,
      ...(typeof body.trackTitle === 'string' ? { trackTitle: body.trackTitle } : {}),
      ...(typeof body.artist === 'string' ? { artist: body.artist } : {}),
      ...(Array.isArray(body.context)
        ? { context: body.context.filter((line): line is string => typeof line === 'string') }
        : {}),
    };

    if (!claudeAvailable()) {
      return {
        meaning:
          'This line is a placeholder breakdown — connect ANTHROPIC_API_KEY for a real explanation.',
        literal: text,
        notes: ['ИИ-разбор работает в симуляции без ключа API.'],
        simulated: true,
      };
    }

    try {
      const result = await explainLine(req);
      return { ...result, simulated: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось разобрать строку';
      return reply.code(502).send({ error: 'explain_failed', message });
    }
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

  app.get('/api/playlists', async () => ({ playlists: await listPlaylists() }));

  app.post('/api/playlists', async (request, reply) => {
    const name = asString((request.body as Record<string, unknown> | undefined)?.name);
    try {
      return await createPlaylist(name);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось создать плейлист';
      return reply.code(400).send({ error: 'bad_request', message });
    }
  });

  app.delete('/api/playlists/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return { playlists: await deletePlaylist(id) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось удалить плейлист';
      return reply.code(400).send({ error: 'bad_request', message });
    }
  });

  app.post('/api/playlists/:id/tracks', async (request, reply) => {
    const { id } = request.params as { id: string };
    const track = trackFromBody((request.body ?? {}) as Record<string, unknown>);
    if (!track) {
      return reply.code(400).send({ error: 'bad_request', message: 'Не указан трек' });
    }
    try {
      return await addTrack(id, track);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось добавить трек';
      return reply.code(400).send({ error: 'bad_request', message });
    }
  });

  app.delete('/api/playlists/:id/tracks/:trackId', async (request, reply) => {
    const { id, trackId } = request.params as { id: string; trackId: string };
    try {
      return await removeTrack(id, trackId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось убрать трек';
      return reply.code(400).send({ error: 'bad_request', message });
    }
  });

  app.post('/api/playlists/favorites/toggle', async (request, reply) => {
    const track = trackFromBody((request.body ?? {}) as Record<string, unknown>);
    if (!track) {
      return reply.code(400).send({ error: 'bad_request', message: 'Не указан трек' });
    }
    try {
      return await toggleFavorite(track);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось обновить избранное';
      return reply.code(400).send({ error: 'bad_request', message });
    }
  });

  app.post('/api/import', async (request, reply): Promise<ImportResponse | void> => {
    const body = (request.body ?? {}) as ImportRequest;
    const source = body.source;
    if (!source) {
      return reply.code(400).send({ error: 'bad_request', message: 'Не указан источник' });
    }

    try {
      let imported;
      if (source === 'deezer') {
        imported = await importFromDeezer(asString(body.url));
      } else if (source === 'youtube') {
        imported = await importFromYoutube(asString(body.url));
      } else if (source === 'spotify') {
        imported = await importFromSpotify(asString(body.url));
      } else if (source === 'text') {
        imported = importFromText(asString(body.body));
      } else {
        return reply.code(400).send({ error: 'bad_request', message: 'Неизвестный источник' });
      }

      let playlistId = body.playlistId;
      if (!playlistId) {
        const created = await createPlaylist(body.name?.trim() || imported.name || 'Импорт');
        playlistId = created.playlist.id;
      }

      const { playlist } = await addTracks(playlistId, imported.tracks);
      return {
        playlist,
        imported: imported.tracks.length,
        skipped: imported.skipped,
        source,
      };
    } catch (error) {
      if (error instanceof ImportUnavailable) {
        return reply.code(422).send({
          error: 'import_failed',
          message: error.message,
          hint: error.hint,
        });
      }
      request.log.error({ err: error }, 'import failed');
      return reply.code(502).send({
        error: 'import_failed',
        message: 'Не удалось импортировать плейлист',
        hint: 'Проверьте ссылку и попробуйте снова.',
      });
    }
  });
}
