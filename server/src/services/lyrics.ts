import type { Lyrics, Track } from '@lyrika/shared';
import { demoLyrics } from '../data/catalog.js';
import { fetchLyrics as fetchLrclib } from './lrclib.js';
import { fetchLyrics as fetchNetease } from './netease.js';
import { fetchLyrics as fetchGenius } from './genius.js';
import {
  cacheRemoteLyrics,
  deleteStoredLyrics,
  readRecord,
  readStoredLyrics,
  writeStoredLyrics,
} from './lyricsDb.js';
import type { LyricsSaveRequest } from '@lyrika/shared';
import { enrichWithTranslation } from './translation.js';

export interface ResolveLyricsOptions {
  translate?: boolean;
}

function trackFromQuery(
  trackId: string,
  query: { title?: string; artist?: string; duration?: string },
): Track {
  return {
    id: trackId,
    title: query.title?.trim() || 'Без названия',
    artist: query.artist?.trim() || '',
    durationSec: Number(query.duration) || 240,
    provider: 'youtube',
    providerId: trackId,
    hasSyncedLyrics: false,
  };
}

async function fetchRemoteChain(track: Track): Promise<Lyrics | null> {
  if (track.artist) {
    try {
      const remote = await fetchLrclib(track);
      if (remote) {
        await cacheRemoteLyrics(remote);
        return remote;
      }
    } catch {
      // LRCLIB blips should not block the chain.
    }

    try {
      const netease = await fetchNetease(track);
      if (netease) {
        await cacheRemoteLyrics(netease);
        return netease;
      }
    } catch {
      // Same for NetEase.
    }

    try {
      const genius = await fetchGenius(track);
      if (genius) {
        await cacheRemoteLyrics(genius, genius.lines.map((l) => l.text).join('\n'));
        return genius;
      }
    } catch {
      // Keyless scrape — best effort.
    }
  }

  const demo = demoLyrics(track.id);
  if (demo) return demo;

  return null;
}

/** Unified lyrics resolver: stored → remote chain → demo. */
export async function resolveLyrics(
  trackId: string,
  query: { title?: string; artist?: string; duration?: string },
  options: ResolveLyricsOptions = {},
): Promise<Lyrics | null> {
  const stored = await readStoredLyrics(trackId);
  if (stored) {
    if (options.translate) {
      return enrichWithTranslation(stored, {
        title: query.title ?? stored.lines[0]?.text ?? '',
        artist: query.artist ?? '',
      });
    }
    return stored;
  }

  const track = trackFromQuery(trackId, query);
  const remote = await fetchRemoteChain(track);
  if (!remote) return null;

  if (options.translate) {
    return enrichWithTranslation(remote, { title: track.title, artist: track.artist });
  }
  return remote;
}

export async function saveLyrics(req: LyricsSaveRequest): Promise<Lyrics> {
  return writeStoredLyrics(req, { source: 'custom', sourceLabel: 'Свой текст', userEdited: true });
}

export async function removeLyrics(trackId: string): Promise<void> {
  await deleteStoredLyrics(trackId);
}

export async function originalLyricsForCompare(trackId: string): Promise<Lyrics | null> {
  const record = await readRecord(trackId);
  if (!record?.originalLines?.length) return null;
  return {
    trackId: record.trackId,
    kind: record.kind,
    source: record.source,
    sourceLabel: record.sourceLabel,
    lines: record.originalLines,
    userEdited: false,
  };
}
