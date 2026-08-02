import type { Playlist, PlaylistTrack, Track } from '@lyrika/shared';
import { JsonStore } from '../lib/store.js';

/** The one reserved list: auto-created on first read and never deletable. */
export const FAVORITES_ID = 'favorites';

const store = new JsonStore<Playlist[]>('playlists', []);

function mintId(): string {
  return `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createFavorites(): Playlist {
  return {
    id: FAVORITES_ID,
    name: 'Избранное',
    favorite: true,
    tracks: [],
    createdAt: Date.now(),
  };
}

/** Favourites first; everything else keeps its newest-first insertion order. */
function ordered(playlists: Playlist[]): Playlist[] {
  return [...playlists].sort((a, b) => Number(b.favorite) - Number(a.favorite));
}

async function ensure(): Promise<Playlist[]> {
  const current = await store.read();
  if (current.some((playlist) => playlist.id === FAVORITES_ID)) return current;
  const next = [createFavorites(), ...current];
  await store.write(next);
  return next;
}

function toPlaylistTrack(track: Track): PlaylistTrack {
  return { ...track, addedAt: Date.now() };
}

function locate(playlists: Playlist[], id: string): Playlist {
  const found = playlists.find((playlist) => playlist.id === id);
  if (!found) throw new Error('Плейлист не найден');
  return found;
}

/** Applies `mutate` to one playlist and persists the whole list. */
async function mutate(
  id: string,
  fn: (playlist: Playlist) => Playlist,
): Promise<{ playlist: Playlist; playlists: Playlist[] }> {
  const current = await ensure();
  const playlist = fn(locate(current, id));
  const next = current.map((entry) => (entry.id === id ? playlist : entry));
  await store.write(next);
  return { playlist, playlists: ordered(next) };
}

export async function listPlaylists(): Promise<Playlist[]> {
  return ordered(await ensure());
}

export async function createPlaylist(
  name: string,
): Promise<{ playlist: Playlist; playlists: Playlist[] }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Не указано название плейлиста');

  const playlist: Playlist = {
    id: mintId(),
    name: trimmed,
    favorite: false,
    tracks: [],
    createdAt: Date.now(),
  };

  const current = await ensure();
  const next = [playlist, ...current];
  await store.write(next);
  return { playlist, playlists: ordered(next) };
}

export async function deletePlaylist(id: string): Promise<Playlist[]> {
  if (id === FAVORITES_ID) throw new Error('Избранное нельзя удалить');
  const current = await ensure();
  locate(current, id);
  const next = current.filter((playlist) => playlist.id !== id);
  await store.write(next);
  return ordered(next);
}

export async function addTrack(
  id: string,
  track: Track,
): Promise<{ playlist: Playlist; playlists: Playlist[] }> {
  return mutate(id, (playlist) =>
    playlist.tracks.some((t) => t.id === track.id)
      ? playlist
      : { ...playlist, tracks: [...playlist.tracks, toPlaylistTrack(track)] },
  );
}

export async function addTracks(
  id: string,
  tracks: Track[],
): Promise<{ playlist: Playlist; playlists: Playlist[] }> {
  return mutate(id, (playlist) => {
    const seen = new Set(playlist.tracks.map((t) => t.id));
    const added: PlaylistTrack[] = [];
    for (const track of tracks) {
      if (seen.has(track.id)) continue;
      seen.add(track.id);
      added.push(toPlaylistTrack(track));
    }
    return added.length ? { ...playlist, tracks: [...playlist.tracks, ...added] } : playlist;
  });
}

export async function removeTrack(
  id: string,
  trackId: string,
): Promise<{ playlist: Playlist; playlists: Playlist[] }> {
  return mutate(id, (playlist) => ({
    ...playlist,
    tracks: playlist.tracks.filter((track) => track.id !== trackId),
  }));
}

export async function toggleFavorite(
  track: Track,
): Promise<{ playlist: Playlist; playlists: Playlist[]; favorited: boolean }> {
  const current = await ensure();
  const favorited = !locate(current, FAVORITES_ID).tracks.some((t) => t.id === track.id);
  const result = favorited
    ? await addTrack(FAVORITES_ID, track)
    : await removeTrack(FAVORITES_ID, track.id);
  return { ...result, favorited };
}
