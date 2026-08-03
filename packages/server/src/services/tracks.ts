import { eq } from 'drizzle-orm';
import type { StreamProvider, Track } from '@lyrika/core';
import type { Db } from '../db/index.js';
import { tracks } from '../db/schema.js';

export async function findTrack(db: Db, id: string): Promise<Track | null> {
  const [row] = await db.select().from(tracks).where(eq(tracks.id, id)).limit(1);
  if (!row) return null;

  return {
    id: row.id,
    provider: row.provider as StreamProvider,
    providerId: row.providerId,
    title: row.title,
    artist: row.artist,
    album: row.album,
    durationSec: row.durationSec,
    thumbUrl: row.thumbUrl,
  };
}

/**
 * Records a track we have seen, so a later `/api/stream` request can find it
 * without the client having to resend the metadata.
 *
 * Search results come from the resolver rather than any local table, so a
 * lookup miss is the *normal* case, not an error — which is why the stream
 * route falls back to reconstructing a track from its id.
 */
export async function rememberTrack(db: Db, track: Track): Promise<void> {
  await db
    .insert(tracks)
    .values({ ...track, createdAt: Date.now() })
    .onConflictDoUpdate({
      target: tracks.id,
      set: {
        title: track.title,
        artist: track.artist,
        album: track.album,
        durationSec: track.durationSec,
        thumbUrl: track.thumbUrl,
      },
    });
}

export async function rememberTracks(db: Db, list: readonly Track[]): Promise<void> {
  for (const track of list) await rememberTrack(db, track);
}
