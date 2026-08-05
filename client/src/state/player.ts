import { create } from 'zustand';
import type { ArtistProfile, Lyrics, ResolvedStream, Track } from '@lyrika/shared';
import { ApiFailure, api } from '../api';
import { PlaybackEngine } from '../audio/engine';
import { useUi } from './ui';
import { useSettings } from './settings';

export const engine = new PlaybackEngine();

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AbLoop {
  a: number;
  b: number | null;
}

interface PlayerState {
  track: Track | null;
  stream: ResolvedStream | null;
  lyrics: Lyrics | null;
  artist: ArtistProfile | null;

  status: LoadStatus;
  error: string | null;
  /** Which row in a result list is mid-resolve, so it can show a spinner. */
  pendingTrackId: string | null;
  lyricsStatus: LoadStatus;

  position: number;
  duration: number;
  playing: boolean;
  rate: number;
  volume: number;

  loopLineId: string | null;
  ab: AbLoop | null;

  queue: Track[];
  recents: Track[];

  playTrack: (track: Track) => Promise<void>;
  playUrl: (url: string) => Promise<void>;
  retry: () => Promise<void>;
  toggle: () => void;
  seek: (seconds: number) => void;
  next: () => void;
  previous: () => void;
  setRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  toggleLoopLine: (lineId: string) => void;
  markAb: () => void;
  clearAb: () => void;
  enqueue: (track: Track) => void;
  enqueueAll: (tracks: Track[]) => void;
  dequeue: (trackId: string) => void;
  clearQueue: () => void;
  applyLyrics: (lyrics: Lyrics) => void;
}

const RECENTS_KEY = 'lyrika.recents';
const RATES = [0.5, 0.75, 1, 1.25] as const;

function loadRecents(): Track[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as Track[]) : [];
  } catch {
    return [];
  }
}

function saveRecents(tracks: Track[]): void {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(tracks.slice(0, 12)));
  } catch {
    // Private-mode storage failures are not worth interrupting playback for.
  }
}

export const usePlayer = create<PlayerState>()((set, get) => ({
  track: null,
  stream: null,
  lyrics: null,
  artist: null,

  status: 'idle',
  error: null,
  pendingTrackId: null,
  lyricsStatus: 'idle',

  position: 0,
  duration: 0,
  playing: false,
  rate: 1,
  volume: 0.78,

  loopLineId: null,
  ab: null,

  queue: [],
  recents: loadRecents(),

  playTrack: async (track) => {
    const { toast } = useUi.getState();
    set({ pendingTrackId: track.id, status: 'loading', error: null });

    try {
      const { track: resolved, stream } = await api.resolve({ trackId: track.id, track });
      const finalTrack = { ...track, ...resolved, id: track.id };

      if (stream.provider === 'demo' || !stream.url) {
        engine.loadVirtual(finalTrack.durationSec);
      } else {
        engine.loadStream(stream.url, finalTrack.durationSec);
      }

      engine.setLoop(null);
      set({
        track: finalTrack,
        stream,
        status: 'ready',
        pendingTrackId: null,
        error: null,
        lyrics: null,
        lyricsStatus: 'loading',
        loopLineId: null,
        ab: null,
        position: 0,
        duration: finalTrack.durationSec,
        recents: (() => {
          const next = [finalTrack, ...get().recents.filter((t) => t.id !== finalTrack.id)];
          saveRecents(next);
          return next.slice(0, 12);
        })(),
      });

      await engine.play();

      void api
        .lyrics(finalTrack)
        .then((lyrics) => {
          if (get().track?.id === finalTrack.id) set({ lyrics, lyricsStatus: 'ready' });
        })
        .catch(() => {
          if (get().track?.id !== finalTrack.id) return;
          set({ lyrics: null, lyricsStatus: 'error' });
          const { aiEnabled, aiAuto } = useSettings.getState();
          toast(
            'Текст не найден ни в одной базе',
            'error',
            aiEnabled && aiAuto
              ? {
                  label: 'Собрать черновик',
                  run: () => {
                    void get().retry();
                  },
                }
              : undefined,
          );
        });

      void api
        .artist(finalTrack.artist)
        .then((artist) => {
          if (get().track?.id === finalTrack.id) set({ artist });
        })
        .catch(() => set({ artist: null }));
    } catch (error) {
      const failure = error instanceof ApiFailure ? error : null;
      const message = failure?.message ?? 'Не удалось получить поток';
      set({ status: 'error', pendingTrackId: null, error: message });
      toast(message, 'error', {
        label: 'Повторить',
        run: () => {
          void get().playTrack(track);
        },
      });
    }
  },

  playUrl: async (url) => {
    const { toast } = useUi.getState();
    set({ status: 'loading', error: null });
    try {
      const { track } = await api.resolve({ url });
      await get().playTrack(track);
    } catch (error) {
      const failure = error instanceof ApiFailure ? error : null;
      const message = failure?.message ?? 'Не удалось разобрать ссылку';
      set({ status: 'error', error: message });
      toast(failure?.hint ? `${message} — ${failure.hint}` : message, 'error');
    }
  },

  retry: async () => {
    const { track } = get();
    if (!track) return;
    const { aiEnabled } = useSettings.getState();
    const { toast } = useUi.getState();

    if (get().lyricsStatus === 'error' && aiEnabled) {
      set({ lyricsStatus: 'loading' });
      try {
        const { withTranslit, withTranslation } = {
          withTranslit: useSettings.getState().aiTranslit,
          withTranslation: useSettings.getState().aiTranslation,
        };
        const response = await api.aiLyrics({
          query: `${track.artist} — ${track.title}`,
          trackId: track.id,
          durationSec: track.durationSec,
          withTranslit,
          withTranslation,
        });
        set({ lyrics: response.lyrics, lyricsStatus: 'ready' });
        toast(response.notice, 'info');
      } catch {
        set({ lyricsStatus: 'error' });
        toast('Ассистент недоступен', 'error');
      }
      return;
    }
    await get().playTrack(track);
  },

  toggle: () => {
    if (!get().track) return;
    if (engine.playing) {
      engine.pause();
    } else {
      void engine.play();
    }
  },

  seek: (seconds) => engine.seek(seconds),

  next: () => {
    const { queue } = get();
    const [head, ...rest] = queue;
    if (!head) return;
    set({ queue: rest });
    void get().playTrack(head);
  },

  previous: () => {
    const { position, recents, track } = get();
    if (position > 4) {
      engine.seek(0);
      return;
    }
    const previous = recents.find((t) => t.id !== track?.id);
    if (previous) void get().playTrack(previous);
    else engine.seek(0);
  },

  setRate: (rate) => {
    engine.setRate(rate);
    set({ rate });
  },

  setVolume: (volume) => {
    engine.setVolume(volume);
    set({ volume });
  },

  toggleLoopLine: (lineId) => {
    const { loopLineId, lyrics } = get();
    if (loopLineId === lineId) {
      engine.setLoop(null);
      set({ loopLineId: null });
      return;
    }
    const line = lyrics?.lines.find((l) => l.id === lineId);
    if (!line) return;
    engine.setLoop({ start: line.time, end: line.end });
    engine.seek(line.time);
    set({ loopLineId: lineId, ab: null });
  },

  markAb: () => {
    const { ab, position } = get();
    if (!ab) {
      set({ ab: { a: position, b: null }, loopLineId: null });
      return;
    }
    if (ab.b === null) {
      const b = Math.max(position, ab.a + 1);
      engine.setLoop({ start: ab.a, end: b });
      engine.seek(ab.a);
      set({ ab: { a: ab.a, b } });
      return;
    }
    get().clearAb();
  },

  clearAb: () => {
    engine.setLoop(null);
    set({ ab: null });
  },

  enqueue: (track) =>
    set((s) => (s.queue.some((t) => t.id === track.id) ? s : { queue: [...s.queue, track] })),

  enqueueAll: (tracks) =>
    set((s) => {
      const known = new Set(s.queue.map((t) => t.id));
      return { queue: [...s.queue, ...tracks.filter((t) => !known.has(t.id))] };
    }),

  dequeue: (trackId) => set((s) => ({ queue: s.queue.filter((t) => t.id !== trackId) })),

  clearQueue: () => set({ queue: [] }),

  applyLyrics: (lyrics) => set({ lyrics, lyricsStatus: 'ready' }),
}));

engine.onUpdate(({ position, duration, playing }) => {
  const state = usePlayer.getState();
  if (
    Math.abs(state.position - position) > 0.02 ||
    state.playing !== playing ||
    Math.abs(state.duration - duration) > 0.5
  ) {
    usePlayer.setState({ position, duration: duration || state.duration, playing });
  }
});

engine.onEnded(() => {
  const { queue, next } = usePlayer.getState();
  if (queue.length) next();
  else usePlayer.setState({ playing: false });
});

export function cycleRate(current: number): number {
  const index = RATES.indexOf(current as (typeof RATES)[number]);
  return RATES[(index + 1) % RATES.length] ?? 1;
}

export function activeLineIndex(lyrics: Lyrics | null, position: number): number {
  if (!lyrics?.lines.length) return -1;
  const lines = lyrics.lines;
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const line = lines[mid];
    if (!line) break;
    if (position >= line.time) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

export function activeWordIndex(
  lyrics: Lyrics | null,
  lineIndex: number,
  position: number,
): number {
  const line = lyrics?.lines[lineIndex];
  if (!line?.words.length) return -1;
  const elapsed = position - line.time;
  let found = 0;
  for (let i = 0; i < line.words.length; i += 1) {
    const offset = line.words[i]?.offset ?? 0;
    if (elapsed >= offset) found = i;
    else break;
  }
  return found;
}
