import { createStore } from 'solid-js/store';
import {
  activeLineIndex,
  interpolateWords,
  type DisplayWord,
  type LyricLine,
  type ParsedLyrics,
  type Track,
} from '@lyrika/core';
import { PlaybackEngine, type Loop } from '../audio/engine.js';
import { api, ApiFailure, type StoredLyrics } from '../api.js';
import { settings } from './settings.js';
import { toast } from './ui.js';

export const engine = new PlaybackEngine();

export type Status = 'idle' | 'loading' | 'ready' | 'error';

interface PlayerState {
  track: Track | null;
  lyrics: ParsedLyrics | null;
  lyricsSource: string | null;
  translations: Map<number, string>;
  translationEnabled: boolean;

  status: Status;
  lyricsStatus: Status;
  error: string | null;
  hint: string | null;

  positionSec: number;
  durationSec: number;
  playing: boolean;

  loopLineIdx: number | null;
  abStart: number | null;
  abEnd: number | null;

  queue: Track[];
}

const [state, setState] = createStore<PlayerState>({
  track: null,
  lyrics: null,
  lyricsSource: null,
  translations: new Map(),
  translationEnabled: false,
  status: 'idle',
  lyricsStatus: 'idle',
  error: null,
  hint: null,
  positionSec: 0,
  durationSec: 0,
  playing: false,
  loopLineIdx: null,
  abStart: null,
  abEnd: null,
  queue: [],
});

export { state as player };

/**
 * The engine ticks at 60 fps but the store is written only past a threshold,
 * so a frame that moved the playhead by a millisecond does not re-render the
 * lyric column. Everything that genuinely needs per-frame values reads them
 * from the engine directly.
 */
// This callback fires from the engine's rAF loop, not from a tracked scope,
// and that is the point: it compares the incoming frame against the last value
// written to the store so it can skip writes below the threshold. A tracked
// scope here would subscribe the loop to its own writes.
// eslint-disable-next-line solid/reactivity -- reading current values, not subscribing
engine.onUpdate(({ positionSec, durationSec, playing }) => {
  if (
    Math.abs(state.positionSec - positionSec) > 0.02 ||
    state.playing !== playing ||
    Math.abs(state.durationSec - durationSec) > 0.5
  ) {
    setState({ positionSec, durationSec: durationSec || state.durationSec, playing });
  }
});

engine.onEnded(() => {
  void next();
});

export async function playTrack(track: Track): Promise<void> {
  setState({
    status: 'loading',
    error: null,
    hint: null,
    lyrics: null,
    lyricsSource: null,
    lyricsStatus: 'loading',
    translations: new Map(),
    loopLineIdx: null,
    abStart: null,
    abEnd: null,
  });

  try {
    const { track: resolved, stream } = await api.resolve(track);
    engine.setLoop(null);
    engine.load(stream.url);
    engine.setRate(settings.rate);
    engine.setVolume(settings.volume);

    setState({
      track: resolved,
      status: 'ready',
      positionSec: 0,
      durationSec: resolved.durationSec,
    });

    await engine.play();
    void loadLyrics(resolved);
  } catch (error) {
    const failure = error instanceof ApiFailure ? error : null;
    setState({
      status: 'error',
      error: failure?.message ?? 'Не удалось воспроизвести трек',
      hint: failure?.hint ?? null,
    });
  }
}

async function loadLyrics(track: Track): Promise<void> {
  try {
    const lyrics: StoredLyrics = await api.lyrics(track);
    // The track may have changed while this was in flight.
    if (state.track?.id !== track.id) return;

    setState({
      lyrics: { kind: lyrics.kind, timingKind: lyrics.timingKind, lines: lyrics.lines },
      lyricsSource: lyrics.sourceId,
      lyricsStatus: 'ready',
    });

    void loadTranslations(track);
  } catch (error) {
    if (state.track?.id !== track.id) return;
    setState({ lyricsStatus: 'error' });
    if (error instanceof ApiFailure && error.hint) toast(error.message, error.hint);
  }
}

async function loadTranslations(track: Track): Promise<void> {
  try {
    const result = await api.translate(track.id);
    if (state.track?.id !== track.id) return;

    const map = new Map<number, string>();
    for (const line of result.lines) {
      if (line.text) map.set(line.idx, line.text);
    }
    setState({ translations: map, translationEnabled: result.enabled });
  } catch {
    // No key configured, or the API is unreachable. The row is simply hidden —
    // v2 printed "перевод недоступен" under every line, which is worse.
    setState({ translationEnabled: false });
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

export function setRate(rate: number): void {
  engine.setRate(rate);
}

export function setVolume(volume: number): void {
  engine.setVolume(volume);
}

export function enqueue(track: Track): void {
  setState('queue', (queue) => [...queue, track]);
}

export function removeFromQueue(index: number): void {
  setState('queue', (queue) => queue.filter((_, i) => i !== index));
}

export async function next(): Promise<void> {
  const [head, ...rest] = state.queue;
  if (!head) return;
  setState('queue', rest);
  await playTrack(head);
}

/** Line boundaries in seconds, falling back to the track end for the last line. */
function lineBounds(line: LyricLine): Loop | null {
  // An unsynced document has no line boundaries to loop between.
  if (line.startMs === null) return null;
  const start = line.startMs / 1000;
  const end = line.endMs !== null ? line.endMs / 1000 : state.durationSec || start + 4;
  return { startSec: start, endSec: end };
}

export function toggleLineLoop(idx: number): void {
  if (state.loopLineIdx === idx) {
    setState('loopLineIdx', null);
    engine.setLoop(null);
    return;
  }

  const line = state.lyrics?.lines[idx];
  if (!line) return;
  const bounds = lineBounds(line);
  if (!bounds) return;

  setState({ loopLineIdx: idx, abStart: null, abEnd: null });
  engine.setLoop(bounds);
  engine.seek(bounds.startSec);
}

/**
 * Three-state A–B: first press marks A, second marks B and engages, third
 * clears. One button rather than three is what makes it usable mid-song.
 */
export function markAb(): void {
  const position = state.positionSec;

  if (state.abStart === null) {
    setState({ abStart: position, abEnd: null, loopLineIdx: null });
    engine.setLoop(null);
    return;
  }

  if (state.abEnd === null) {
    const start = Math.min(state.abStart, position);
    const end = Math.max(state.abStart, position);
    if (end - start < 0.3) {
      // Too short to be a loop; treat it as re-marking A.
      setState({ abStart: position });
      return;
    }
    setState({ abStart: start, abEnd: end });
    engine.setLoop({ startSec: start, endSec: end });
    return;
  }

  setState({ abStart: null, abEnd: null });
  engine.setLoop(null);
}

export function clearLoops(): void {
  setState({ abStart: null, abEnd: null, loopLineIdx: null });
  engine.setLoop(null);
}

/** Index of the line under the playhead, or -1. */
export function currentLineIndex(): number {
  const lines = state.lyrics?.lines;
  if (!lines?.length) return -1;
  return activeLineIndex(lines, state.positionSec * 1000);
}

/**
 * Display words for a line. Timings the source supplied come through exact;
 * the rest are interpolated *here*, at render time, and marked `exact: false`
 * so the view can render them with less confidence.
 */
export function displayWords(line: LyricLine): DisplayWord[] {
  return interpolateWords(line, (state.durationSec || 0) * 1000);
}
