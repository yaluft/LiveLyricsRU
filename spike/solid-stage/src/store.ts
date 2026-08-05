import { createStore } from 'solid-js/store';
import type { Lyrics, Track } from '@lyrika/shared';
import { PlaybackEngine } from './audio/engine';
import { api } from './api';

/**
 * Small Solid port of the slice of client/src/state/player.ts (374 lines)
 * this spike actually needs: track/lyrics/position/playing/status. Everything
 * else (queue, loops, recents, artist, AI retry) is out of scope — see the
 * task's OUT-OF-SCOPE list.
 *
 * Zustand's `create()` gives you a subscribable store object; Solid's
 * `createStore` gives you a `[state, setState]` tuple with the same "reach it
 * via getters, mutate via a setter" shape. The port below is close to
 * line-for-line for the parts it keeps.
 */

export const engine = new PlaybackEngine();

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface PlayerState {
  track: Track | null;
  lyrics: Lyrics | null;
  status: LoadStatus;
  lyricsStatus: LoadStatus;
  error: string | null;

  position: number;
  duration: number;
  playing: boolean;
}

const [state, setState] = createStore<PlayerState>({
  track: null,
  lyrics: null,
  status: 'idle',
  lyricsStatus: 'idle',
  error: null,
  position: 0,
  duration: 0,
  playing: false,
});

export { state as playerState };

export async function playDemoTrack(trackId: string): Promise<void> {
  setState({ status: 'loading', error: null, lyrics: null, lyricsStatus: 'loading' });
  try {
    const { track, stream } = await api.resolve(trackId);

    if (stream.provider === 'demo' || !stream.url) {
      engine.loadVirtual(track.durationSec);
    } else {
      engine.loadStream(stream.url, track.durationSec);
    }
    engine.setLoop(null);

    setState({
      track,
      status: 'ready',
      position: 0,
      duration: track.durationSec,
    });

    await engine.play();

    void api
      .lyrics(track)
      .then((lyrics) => {
        if (state.track?.id === track.id) setState({ lyrics, lyricsStatus: 'ready' });
      })
      .catch(() => {
        if (state.track?.id === track.id) setState({ lyrics: null, lyricsStatus: 'error' });
      });
  } catch (error) {
    setState({ status: 'error', error: error instanceof Error ? error.message : 'Не удалось получить поток' });
  }
}

export function toggle(): void {
  if (!state.track) return;
  if (engine.playing) engine.pause();
  else void engine.play();
}

export function seek(seconds: number): void {
  engine.seek(seconds);
}

// Same rAF-driven update pattern as client/src/state/player.ts: the engine
// ticks at 60fps but the store only writes past a threshold so consumers of
// `playerState` don't re-render every frame.
engine.onUpdate(({ position, duration, playing }) => {
  if (
    Math.abs(state.position - position) > 0.02 ||
    state.playing !== playing ||
    Math.abs(state.duration - duration) > 0.5
  ) {
    setState({ position, duration: duration || state.duration, playing });
  }
});

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

export function activeWordIndex(lyrics: Lyrics | null, lineIndex: number, position: number): number {
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
