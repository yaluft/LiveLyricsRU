import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { trackFromId, type Track } from '@lyrika/core';
import { getDb } from '../db/index.js';
import { contentRange, parseRange } from '../http/range.js';
import { evictStream, getStream, shouldEvictOn } from '../services/streamCache.js';
import { findTrack } from '../services/tracks.js';
import { findUpload, uploadPath } from '../services/uploads.js';
import { ResolveFailed, ResolverUnavailable } from '../services/ytdlp.js';

export async function streamRoutes(app: FastifyInstance): Promise<void> {
  /**
   * The only audio URL the browser ever sees.
   *
   * A resolved upstream URL is IP-bound and CORS-less: it works from this
   * process and nowhere else. Handing it to the client would break playback and
   * leak the resolver's address, so every source — local upload or remote
   * stream — is served through this one route instead.
   */
  app.get<{ Params: { trackId: string } }>('/stream/:trackId', async (request, reply) => {
    // Fastify has already percent-decoded this. Decoding again corrupts any id
    // containing a literal '%'.
    const { trackId } = request.params;

    const track = (await findTrack(getDb(), trackId)) ?? trackFromId(trackId);
    if (!track) {
      return reply.code(404).send({ error: 'unknown_track', message: 'Трек не найден' });
    }

    return track.provider === 'upload'
      ? serveUpload(request, reply, track)
      : proxyRemote(request, reply, track);
  });
}

async function serveUpload(
  request: FastifyRequest,
  reply: FastifyReply,
  track: Track,
): Promise<FastifyReply> {
  const upload = await findUpload(getDb(), track.providerId);
  if (!upload) {
    return reply.code(404).send({ error: 'unknown_track', message: 'Файл не найден' });
  }

  const path = uploadPath(upload.sha256);
  let size: number;
  try {
    ({ size } = await stat(path));
  } catch {
    request.log.error({ trackId: track.id }, 'upload row exists but the file is gone');
    return reply.code(410).send({ error: 'stream_gone', message: 'Файл больше недоступен' });
  }

  reply.header('Accept-Ranges', 'bytes');
  reply.header('Content-Type', upload.mimeType);
  reply.header('Cache-Control', 'private, max-age=3600');

  const parsed = parseRange(request.headers.range, size);

  if (parsed.kind === 'unsatisfiable') {
    reply.header('Content-Range', `bytes */${size}`);
    return reply.code(416).send();
  }

  if (parsed.kind === 'none') {
    reply.header('Content-Length', size);
    return reply.code(200).send(createReadStream(path));
  }

  const { start, end } = parsed.range;
  reply.header('Content-Range', contentRange(parsed.range, size));
  reply.header('Content-Length', end - start + 1);
  return reply.code(206).send(createReadStream(path, { start, end }));
}

async function proxyRemote(
  request: FastifyRequest,
  reply: FastifyReply,
  track: Track,
): Promise<FastifyReply> {
  let stream;
  try {
    stream = await getStream(track);
  } catch (error) {
    if (error instanceof ResolverUnavailable) {
      return reply.code(503).send({
        error: 'resolver_unavailable',
        message: 'Резолвер недоступен',
        hint: 'Загрузите файл со своего устройства.',
      });
    }
    if (error instanceof ResolveFailed) {
      return reply.code(422).send({
        error: 'resolve_failed',
        message: error.message,
        ...(error.hint ? { hint: error.hint } : {}),
      });
    }
    throw error;
  }

  // The client's Range is forwarded verbatim, so a seek costs one upstream
  // request rather than a full re-download.
  const range = request.headers.range;
  const upstream = await fetch(stream.url, { headers: range ? { Range: range } : {} }).catch(
    () => null,
  );

  if (!upstream) {
    evictStream(track.id);
    return reply.code(502).send({ error: 'stream_failed', message: 'Источник недоступен' });
  }

  if (upstream.status === 416) {
    // Only this range was bad — the URL is still valid, so the cache entry
    // stays and the client is free to ask for a different range.
    const upstreamRange = upstream.headers.get('content-range');
    if (upstreamRange) reply.header('Content-Range', upstreamRange);
    return reply.code(416).send();
  }

  if (!upstream.ok) {
    if (shouldEvictOn(upstream.status)) {
      // The URL itself went stale — expired signature, or bound to an address
      // we no longer present from. Drop it so the next request re-resolves
      // instead of replaying a dead URL forever.
      evictStream(track.id);
    }
    request.log.warn({ status: upstream.status, trackId: track.id }, 'upstream returned non-ok');
    return reply.code(502).send({ error: 'stream_failed', message: 'Источник недоступен' });
  }

  for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const value = upstream.headers.get(header);
    if (value) reply.header(header, value);
  }
  if (!upstream.headers.get('accept-ranges')) reply.header('Accept-Ranges', 'bytes');

  reply.code(upstream.status);
  return reply.send(upstream.body ? Readable.fromWeb(upstream.body) : null);
}
