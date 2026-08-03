import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { saveLyrics } from '../services/lyrics.js';
import {
  discardUpload,
  receiveUpload,
  registerUpload,
  UploadRejected,
  type ReceivedUpload,
} from '../services/uploads.js';

interface PendingFile {
  received: ReceivedUpload;
  filename: string;
  mimeType: string;
  truncated: boolean;
}

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Multipart ingest: an `audio` file, an optional `lrc` sidecar, and the
   * `title` / `artist` / `durationSec` fields.
   *
   * Every part is consumed before anything is registered, so the client may
   * order the form however it likes.
   *
   * Duration comes from the client — it can read it off an object URL before
   * uploading. Probing server-side would mean depending on ffmpeg, which this
   * app deliberately does not require.
   */
  app.post('/uploads', async (request, reply) => {
    const db = getDb();
    const fields: Record<string, string> = {};
    let file: PendingFile | null = null;
    let lrc: string | null = null;

    try {
      for await (const part of request.parts()) {
        // Accept the sidecar either as an attached .lrc file or as a plain text
        // field — a browser sending a File and a script sending a string are
        // both reasonable, and the distinction is invisible to the user.
        if (part.fieldname === 'lrc') {
          lrc =
            part.type === 'field'
              ? String(part.value)
              : (await part.toBuffer()).toString('utf8');
          continue;
        }

        if (part.type === 'field') {
          fields[part.fieldname] = String(part.value);
          continue;
        }

        if (part.fieldname !== 'audio') {
          // Drain, or the multipart parser stalls waiting on the stream.
          await part.toBuffer();
          continue;
        }

        const received = await receiveUpload(part.file, part.mimetype);
        file = {
          received,
          filename: part.filename,
          mimeType: part.mimetype,
          truncated: part.file.truncated,
        };
      }
    } catch (error) {
      if (file) await discardUpload(file.received.sha256);
      if (error instanceof UploadRejected) {
        return reply.code(415).send({
          error: 'unsupported_media',
          message: error.message,
          ...(error.hint ? { hint: error.hint } : {}),
        });
      }
      throw error;
    }

    if (!file) {
      return reply.code(400).send({
        error: 'no_audio',
        message: 'Аудиофайл не приложен',
        hint: 'Отправьте файл в поле «audio».',
      });
    }

    if (file.truncated) {
      // The bytes on disk are only a prefix of the real file — registering them
      // would produce a track that plays and then stops mid-song.
      await discardUpload(file.received.sha256);
      return reply.code(413).send({
        error: 'upload_too_large',
        message: 'Файл больше допустимого размера',
        hint: 'Увеличьте MAX_UPLOAD_BYTES или загрузите файл поменьше.',
      });
    }

    const track = await registerUpload(db, file.received, {
      filename: file.filename,
      mimeType: file.mimeType,
      title: fields.title ?? '',
      artist: fields.artist ?? '',
      durationSec: Number(fields.durationSec) || 0,
    });

    const stored = lrc ? await saveLyrics(db, track.id, 'upload', lrc) : null;

    return reply.code(201).send({
      track,
      lyrics: stored
        ? { kind: stored.kind, timingKind: stored.timingKind, lineCount: stored.lines.length }
        : null,
    });
  });
}
