import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import { trackFromId } from '@lyrika/core';
import { getDb } from '../db/index.js';
import { contentRange, parseRange } from '../http/range.js';
import { findUpload, uploadPath } from '../services/uploads.js';

export async function streamRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Byte-range audio. Uploads are served straight off disk here; resolved
   * remote streams are proxied through the same URL shape in a later phase, so
   * the client never learns whether it is playing a local file or a CDN.
   *
   * The client must never receive an upstream URL: a resolved CDN URL is
   * IP-bound and CORS-less, so handing it over breaks playback and leaks the
   * resolver's identity. `/api/stream/:trackId` is the only audio URL the
   * browser ever sees.
   */
  app.get<{ Params: { trackId: string } }>('/stream/:trackId', async (request, reply) => {
    // Fastify has already percent-decoded this. Decoding again corrupts any id
    // containing a literal '%'.
    const { trackId } = request.params;

    const track = trackFromId(trackId);
    if (!track) {
      return reply.code(404).send({ error: 'unknown_track', message: 'Трек не найден' });
    }

    if (track.provider !== 'upload') {
      return reply.code(501).send({
        error: 'not_implemented',
        message: 'Разрешение внешних источников ещё не подключено',
        hint: 'Загрузите файл со своего устройства.',
      });
    }

    const upload = await findUpload(getDb(), track.providerId);
    if (!upload) {
      return reply.code(404).send({ error: 'unknown_track', message: 'Файл не найден' });
    }

    const path = uploadPath(upload.sha256);
    let size: number;
    try {
      ({ size } = await stat(path));
    } catch {
      request.log.error({ trackId }, 'upload row exists but the file is gone');
      return reply.code(410).send({ error: 'stream_gone', message: 'Файл больше недоступен' });
    }

    reply.header('Accept-Ranges', 'bytes');
    reply.header('Content-Type', upload.mimeType);
    reply.header('Cache-Control', 'private, max-age=3600');

    const parsed = parseRange(request.headers.range, size);

    if (parsed.kind === 'unsatisfiable') {
      // Only this range was bad — the resource itself is fine, so nothing is
      // invalidated and the client is free to ask for a different range.
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
  });
}
