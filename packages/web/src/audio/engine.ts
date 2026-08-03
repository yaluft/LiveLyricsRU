import { audioLevel } from './level.js';

export interface PlaybackState {
  positionSec: number;
  durationSec: number;
  playing: boolean;
}

export interface Loop {
  startSec: number;
  endSec: number;
}

type Listener = (state: PlaybackState) => void;

const FFT_SIZE = 256;

/**
 * One playback interface over an `<audio>` element.
 *
 * Position, loops and end-of-track are enforced on a `requestAnimationFrame`
 * tick rather than on media events. Media events fire on the browser's own
 * schedule — `timeupdate` lands roughly every 250 ms and slows further at
 * reduced playback rates — which is far too coarse to hold a loop point. That
 * is why A–B and line loops here stay tight at 0.5×.
 */
export class PlaybackEngine {
  #audio: HTMLAudioElement | null = null;
  #context: AudioContext | null = null;
  #source: MediaElementAudioSourceNode | null = null;
  #analyser: AnalyserNode | null = null;
  #bins: Uint8Array<ArrayBuffer> | null = null;
  #frame = 0;
  #listeners = new Set<Listener>();
  #loop: Loop | null = null;
  #rate = 1;
  #volume = 1;
  #synthPhase = 0;
  #onEnded: (() => void) | null = null;

  get playing(): boolean {
    return this.#audio !== null && !this.#audio.paused && !this.#audio.ended;
  }

  get positionSec(): number {
    return this.#audio?.currentTime ?? 0;
  }

  get durationSec(): number {
    const value = this.#audio?.duration ?? 0;
    return Number.isFinite(value) ? value : 0;
  }

  onUpdate(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  onEnded(handler: () => void): void {
    this.#onEnded = handler;
  }

  load(url: string): void {
    this.#teardownAudio();

    const audio = new Audio();
    // Same-origin by construction — the server proxies every source through
    // /api/stream — but declaring it is what lets the analyser read the data
    // instead of being handed silence.
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.src = url;
    audio.playbackRate = this.#rate;
    audio.volume = this.#volume;
    audio.addEventListener('ended', () => this.#onEnded?.());

    this.#audio = audio;
    this.#start();
  }

  async play(): Promise<void> {
    if (!this.#audio) return;
    await this.#audio.play().catch(() => undefined);
    // Browsers only allow an AudioContext to start inside a user gesture, so
    // this has to happen here rather than at construction.
    this.#ensureAnalyser();
    await this.#context?.resume().catch(() => undefined);
  }

  pause(): void {
    this.#audio?.pause();
  }

  seek(seconds: number): void {
    if (!this.#audio) return;
    this.#audio.currentTime = Math.max(0, Math.min(seconds, this.durationSec || seconds));
    this.#emit();
  }

  setRate(rate: number): void {
    this.#rate = rate;
    if (this.#audio) this.#audio.playbackRate = rate;
  }

  setVolume(volume: number): void {
    this.#volume = volume;
    if (this.#audio) this.#audio.volume = volume;
  }

  setLoop(loop: Loop | null): void {
    this.#loop = loop;
    if (loop && this.positionSec < loop.startSec) this.seek(loop.startSec);
  }

  getLoop(): Loop | null {
    return this.#loop;
  }

  dispose(): void {
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#teardownAudio();
    void this.#context?.close().catch(() => undefined);
    this.#context = null;
    this.#listeners.clear();
  }

  #teardownAudio(): void {
    if (!this.#audio) return;
    this.#audio.pause();
    this.#audio.removeAttribute('src');
    this.#audio.load();
    this.#audio = null;

    // A MediaElementSource is bound to the element that created it and cannot
    // be reused, so each track makes a new one. The AudioContext outlives them
    // all, so without disconnecting here every track played leaves an orphaned
    // node wired into the graph for the rest of the session.
    this.#source?.disconnect();
    this.#analyser?.disconnect();
    this.#source = null;
    this.#analyser = null;
    this.#bins = null;
  }

  #ensureAnalyser(): void {
    if (this.#analyser || !this.#audio) return;
    try {
      const context = this.#context ?? new AudioContext();
      this.#context = context;
      const source = context.createMediaElementSource(this.#audio);
      const analyser = context.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyser.connect(context.destination);
      this.#source = source;
      this.#analyser = analyser;
      this.#bins = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    } catch {
      // Autoplay policy or a cross-origin stream. The synthetic level below
      // keeps the water moving rather than freezing it, which would read as a
      // broken page instead of a missing analyser.
      this.#analyser = null;
    }
  }

  #sampleLevel(): void {
    const analyser = this.#analyser;
    const bins = this.#bins;

    if (!analyser || !bins) {
      if (!this.playing) {
        audioLevel.value *= 0.9;
        return;
      }
      // Three detuned sines: not the music, but musical enough that the motion
      // reads as responsive rather than as a metronome.
      this.#synthPhase += 0.017 * this.#rate;
      const p = this.#synthPhase;
      const value =
        0.35 + 0.2 * Math.sin(p) + 0.12 * Math.sin(p * 2.7 + 1.1) + 0.08 * Math.sin(p * 5.3 + 2.2);
      audioLevel.value = Math.max(0, Math.min(1, value));
      return;
    }

    analyser.getByteFrequencyData(bins);
    let sum = 0;
    for (let i = 0; i < bins.length; i += 1) sum += bins[i]!;
    audioLevel.value = sum / (bins.length * 255);
  }

  #start(): void {
    if (this.#frame !== 0) return;

    const tick = (): void => {
      this.#frame = requestAnimationFrame(tick);

      const loop = this.#loop;
      if (loop && this.#audio && this.playing) {
        const position = this.positionSec;
        // The lower bound has slack: a seek lands approximately, and treating a
        // few milliseconds of undershoot as "escaped the loop" would make it
        // stutter backwards on every pass.
        if (position >= loop.endSec || position < loop.startSec - 0.25) {
          this.#audio.currentTime = loop.startSec;
        }
      }

      this.#sampleLevel();
      this.#emit();
    };

    this.#frame = requestAnimationFrame(tick);
  }

  #emit(): void {
    const state: PlaybackState = {
      positionSec: this.positionSec,
      durationSec: this.durationSec,
      playing: this.playing,
    };
    for (const listener of this.#listeners) listener(state);
  }
}
