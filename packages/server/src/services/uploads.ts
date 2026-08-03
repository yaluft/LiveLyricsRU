import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { eq } from 'drizzle-orm';
import { trackId as makeTrackId, type Track } from '@lyrika/core';
import { config } from '../config.js';
import type { Db } from '../db/index.js';
import { tracks, uploads } from '../db/schema.js';

/** Audio types a browser `<audio>` element can actually decode. */
const ALLOWED_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/opus',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/webm',
  'audio/flac',
  'audio/x-flac',
]);

export class UploadRejected extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'UploadRejected';
  }
}

export function isAllowedAudioType(mimeType: string): boolean {
  return ALLOWED_MIME.has(mimeType.split(';')[0]!.trim().toLowerCase());
}

export function uploadPath(sha256: string): string {
  return join(config.uploadsDir, sha256);
}

export interface ReceivedUpload {
  sha256: string;
  byteSize: number;
}

export interface UploadMeta {
  filename: string;
  mimeType: string;
  title: string;
  artist: string;
  durationSec: number;
}

/**
 * Streams an upload to disk and names the file by its own digest.
 *
 * Deliberately separate from `registerUpload`: multipart parts arrive in
 * whatever order the client wrote them, so the file may land before the title
 * and duration fields do. Doing both in one step would silently depend on
 * field ordering — a bug that only surfaces against a client that happens to
 * serialise its form differently.
 *
 * Content addressing also makes re-uploading the same bytes idempotent, and
 * keeps user-supplied filenames out of the filesystem path entirely.
 */
export async function receiveUpload(
  source: NodeJS.ReadableStream,
  mimeType: string,
): Promise<ReceivedUpload> {
  if (!isAllowedAudioType(mimeType)) {
    throw new UploadRejected(
      `Формат ${mimeType} не поддерживается`,
      'Загрузите MP3, M4A, OGG, WAV или FLAC.',
    );
  }

  const temp = join(config.uploadsDir, `.incoming-${randomUUID()}`);
  const hash = createHash('sha256');

  try {
    // Hashing in a PassThrough keeps this to one pass over the upload; hashing
    // the finished file would mean reading every byte twice.
    const tee = new PassThrough();
    tee.on('data', (chunk: Buffer) => hash.update(chunk));
    await pipeline(source, tee, createWriteStream(temp));
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }

  const sha256 = hash.digest('hex');
  const { size } = await stat(temp);

  if (size === 0) {
    await rm(temp, { force: true });
    throw new UploadRejected('Файл пуст');
  }

  // rename() onto the digest path is atomic, so a concurrent upload of the same
  // bytes can never expose a half-written file to a range request.
  await rename(temp, uploadPath(sha256));

  return { sha256, byteSize: size };
}

export async function registerUpload(
  db: Db,
  received: ReceivedUpload,
  meta: UploadMeta,
): Promise<Track> {
  const { sha256, byteSize } = received;
  const now = Date.now();

  await db
    .insert(uploads)
    .values({
      id: sha256,
      filename: meta.filename,
      mimeType: meta.mimeType,
      byteSize,
      durationSec: meta.durationSec,
      sha256,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: uploads.id,
      set: { filename: meta.filename, mimeType: meta.mimeType, durationSec: meta.durationSec },
    });

  const track: Track = {
    id: makeTrackId('upload', sha256),
    provider: 'upload',
    providerId: sha256,
    title: meta.title || meta.filename,
    artist: meta.artist,
    album: null,
    durationSec: meta.durationSec,
    thumbUrl: null,
  };

  await db
    .insert(tracks)
    .values({ ...track, createdAt: now })
    .onConflictDoUpdate({
      target: tracks.id,
      // A re-upload may carry a better title, or a duration the first attempt
      // lacked, so let it correct the record rather than keep the worse one.
      set: { title: track.title, artist: track.artist, durationSec: track.durationSec },
    });

  return track;
}

export async function findUpload(db: Db, sha256: string) {
  const [row] = await db.select().from(uploads).where(eq(uploads.id, sha256)).limit(1);
  return row ?? null;
}

/** Removes a received file that never got registered. */
export async function discardUpload(sha256: string): Promise<void> {
  await rm(uploadPath(sha256), { force: true });
}
