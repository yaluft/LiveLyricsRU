import { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import type { SearchResponse } from '@lyrika/shared';
import { findTrack, searchCatalog } from '../data/catalog.js';
import {
  ResolveFailed,
  YtDlpUnavailable,
  resolveTrack,
  resolveUrl,
  searchTracks,
} from '../services/ytdlp.js';
import { looksLikeUrl } from '../services/urlGuard.js';
import {
  cacheStream,
  evictCachedStream,
  getCachedStream,
  proxyStreamUrl,
  STREAM_INFLIGHT,
} from '../lib/streamCache.js';
import { asString, sendApiError, trackFromBody, trackFromId } from './shared.js';

export function registerSearchRoutes(app: FastifyInstance): void {
  app.get('/api/search', async (request, reply): Promise<SearchResponse | void> => {
    const query = asString((request.query as Record<string, unknown>).q).trim();
    if (!query) return { query, results: [], sampled: false };

    if (looksLikeUrl(query)) {
      try {
        const { track, stream } = await resolveUrl(query);
        await cacheStream(track.id, stream.url, stream.mimeType);
        return { query, results: [track], sampled: false };
      } catch (error) {
        if (error instanceof ResolveFailed) {
          return sendApiError(reply, 422, 'resolve_failed', error.message, error.hint);
        }
        if (!(error instanceof YtDlpUnavailable)) {
          request.log.warn({ err: error }, 'url search failed');
        }
        return sendApiError(
          reply,
          503,
          'resolver_unavailable',
          'Резолвер недоступен — yt-dlp не установлен',
          'Ищите по названию: работает демо-каталог.',
        );
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
        await cacheStream(track.id, stream.url, stream.mimeType);
        return { track, stream: { ...stream, url: proxyStreamUrl(track.id) } };
      }
      // Search results come from yt-dlp, not the demo catalogue, so a catalogue
      // miss is normal — fall back to the track the client sent, then to the
      // `provider:providerId` encoded in the id itself.
      const track = findTrack(trackId) ?? trackFromBody(body) ?? trackFromId(trackId);
      if (!track) {
        return sendApiError(reply, 404, 'unknown_track', 'Трек не найден', 'Начните новый поиск.');
      }
      const stream = await resolveTrack(track);
      await cacheStream(track.id, stream.url, stream.mimeType);
      return { track, stream: { ...stream, url: proxyStreamUrl(track.id) } };
    } catch (error) {
      if (error instanceof ResolveFailed) {
        return sendApiError(reply, 422, 'resolve_failed', error.message, error.hint);
      }
      if (error instanceof YtDlpUnavailable) {
        return sendApiError(
          reply,
          503,
          'resolver_unavailable',
          'yt-dlp не установлен на сервере',
          'Демо-треки играют без него.',
        );
      }
      request.log.error({ err: error }, 'resolve failed');
      return sendApiError(reply, 502, 'resolve_failed', 'Не удалось получить поток', 'Повторите попытку.');
    }
  });

  app.get('/api/stream/:trackId', async (request, reply) => {
    // Fastify's router already decodes route params; decoding again corrupts
    // (or throws on) ids that contain a literal `%`.
    const trackId = (request.params as { trackId: string }).trackId;

    let cached = await getCachedStream(trackId);
    if (!cached) {
      const track = findTrack(trackId) ?? trackFromId(trackId);
      if (!track) {
        return sendApiError(reply, 404, 'unknown_track', 'Трек не найден');
      }
      try {
        let pending = STREAM_INFLIGHT.get(trackId);
        if (!pending) {
          pending = resolveTrack(track).finally(() => STREAM_INFLIGHT.delete(trackId));
          STREAM_INFLIGHT.set(trackId, pending);
        }
        const stream = await pending;
        await cacheStream(trackId, stream.url, stream.mimeType);
        cached = await getCachedStream(trackId);
      } catch (error) {
        if (error instanceof ResolveFailed) {
          return sendApiError(reply, 422, 'resolve_failed', error.message, error.hint);
        }
        if (error instanceof YtDlpUnavailable) {
          return sendApiError(reply, 503, 'resolver_unavailable', 'yt-dlp не установлен на сервере');
        }
        request.log.error({ err: error }, 'stream resolve failed');
        return sendApiError(reply, 502, 'resolve_failed', 'Не удалось получить поток');
      }
    }
    if (!cached) {
      return sendApiError(reply, 502, 'resolve_failed', 'Не удалось получить поток');
    }

    const range = request.headers.range;
    let upstream: Response;
    try {
      upstream = await fetch(cached.url, range ? { headers: { range } } : undefined);
    } catch (error) {
      request.log.error({ err: error }, 'stream upstream fetch failed');
      return sendApiError(reply, 502, 'stream_failed', 'Источник недоступен');
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
        await evictCachedStream(trackId);
      }
      request.log.warn({ status: upstream.status, trackId }, 'stream upstream returned non-ok');
      return sendApiError(reply, 502, 'stream_failed', 'Источник недоступен');
    }

    reply.code(upstream.status);
    reply.header('Content-Type', cached.mimeType);
    // Overrides whatever caching header the upstream video CDN sent (which may
    // be `no-cache`): the audio bytes for a given trackId are stable forever,
    // so this response is safe to cache — a prerequisite for CDN edge-caching
    // of these responses (see docs/cdn-recommendations.md).
    reply.header('Cache-Control', 'public, max-age=86400');
    if (upstream.status === 206) reply.header('Accept-Ranges', 'bytes');
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) reply.header('Content-Range', contentRange);
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) reply.header('Content-Length', contentLength);

    return reply.send(upstream.body ? Readable.fromWeb(upstream.body as never) : null);
  });
}
