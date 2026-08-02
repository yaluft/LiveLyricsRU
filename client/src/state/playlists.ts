import { create } from 'zustand';
import type { ImportRequest, ImportResponse, Playlist, Track } from '@lyrika/shared';
import { ApiFailure, api } from '../api';
import { useUi } from './ui';

interface PlaylistsState {
  playlists: Playlist[];
  loaded: boolean;
  importing: boolean;
  /** True while the playlists pseudo-view is showing; see `ViewId` note below. */
  panelOpen: boolean;

  load: () => Promise<void>;
  create: (name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addTrack: (id: string, track: Track) => Promise<void>;
  removeTrack: (id: string, trackId: string) => Promise<void>;
  toggleFavorite: (track: Track) => Promise<void>;
  runImport: (payload: ImportRequest) => Promise<ImportResponse | null>;
  setPanel: (open: boolean) => void;
}

function failureMessage(error: unknown, fallback: string): string {
  return error instanceof ApiFailure ? error.message : fallback;
}

export const usePlaylists = create<PlaylistsState>()((set, get) => ({
  playlists: [],
  loaded: false,
  importing: false,
  panelOpen: false,

  load: async () => {
    try {
      const { playlists } = await api.playlists();
      set({ playlists, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  create: async (name) => {
    const { toast } = useUi.getState();
    const clean = name.trim();
    if (!clean) return;
    try {
      const { playlists } = await api.createPlaylist(clean);
      set({ playlists });
      toast(`«${clean}» создан`, 'success');
    } catch (error) {
      toast(failureMessage(error, 'Не удалось создать плейлист'), 'error');
    }
  },

  remove: async (id) => {
    const { toast } = useUi.getState();
    try {
      const { playlists } = await api.deletePlaylist(id);
      set({ playlists });
    } catch (error) {
      toast(failureMessage(error, 'Не удалось удалить плейлист'), 'error');
    }
  },

  addTrack: async (id, track) => {
    const { toast } = useUi.getState();
    try {
      const { playlist, playlists } = await api.addToPlaylist(id, track);
      set({ playlists });
      toast(`«${track.title}» → ${playlist.name}`, 'success');
    } catch (error) {
      toast(failureMessage(error, 'Не удалось добавить трек'), 'error');
    }
  },

  removeTrack: async (id, trackId) => {
    const { toast } = useUi.getState();
    try {
      const { playlists } = await api.removeFromPlaylist(id, trackId);
      set({ playlists });
    } catch (error) {
      toast(failureMessage(error, 'Не удалось убрать трек'), 'error');
    }
  },

  toggleFavorite: async (track) => {
    const { toast } = useUi.getState();
    try {
      const { playlists, favorited } = await api.toggleFavorite(track);
      set({ playlists });
      toast(favorited ? `«${track.title}» в избранном` : `«${track.title}» убран из избранного`, 'success');
    } catch (error) {
      toast(failureMessage(error, 'Не удалось изменить избранное'), 'error');
    }
  },

  runImport: async (payload) => {
    const { toast } = useUi.getState();
    set({ importing: true });
    try {
      const response = await api.importPlaylist(payload);
      const { playlists } = await api.playlists().catch(() => ({ playlists: get().playlists }));
      set({ playlists });
      return response;
    } catch (error) {
      toast(failureMessage(error, 'Импорт не удался'), 'error');
      return null;
    } finally {
      set({ importing: false });
    }
  },

  setPanel: (open) => set({ panelOpen: open }),
}));

/** The reserved favourites list, if the server has handed it over yet. */
export function favoritesPlaylist(playlists: Playlist[]): Playlist | undefined {
  return playlists.find((p) => p.favorite);
}

export function isFavorite(trackId: string): boolean {
  const favourites = favoritesPlaylist(usePlaylists.getState().playlists);
  return favourites ? favourites.tracks.some((t) => t.id === trackId) : false;
}

/** Reactive form of `isFavorite` for components. */
export function useIsFavorite(trackId: string | undefined): boolean {
  return usePlaylists((s) => {
    if (!trackId) return false;
    const favourites = s.playlists.find((p) => p.favorite);
    return favourites ? favourites.tracks.some((t) => t.id === trackId) : false;
  });
}

/**
 * `ViewId` has no `playlists` member and `state/ui.ts` is owned elsewhere, so the
 * playlists pane rides along as a flag here. Any real view change retires it.
 */
useUi.subscribe((state, prev) => {
  if (state.view !== prev.view && usePlaylists.getState().panelOpen) {
    usePlaylists.setState({ panelOpen: false });
  }
});
