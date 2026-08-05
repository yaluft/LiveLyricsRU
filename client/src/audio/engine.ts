import { audioLevel, audioSpectrum } from './level';

export interface EngineState {
  position: number;
  duration: number;
  playing: boolean;
}

type Listener = (state: EngineState) => void;
type EndedListener = () => void;

/**
 * Playback has two backends behind one interface: a real <audio> element for
 * resolved streams, and a virtual clock for demo tracks that have no audio.
 * The UI cannot tell them apart, so every screen stays exercisable without a
 * working yt-dlp install.
 */
export class PlaybackEngine {
  #audio: HTMLAudioElement | null = null;
  #ctx: AudioContext | null = null;
  #analyser: AnalyserNode | null = null;
  #bins: Uint8Array<ArrayBuffer> | null = null;

  #virtual = false;
  #virtualPosition = 0;
  #virtualDuration = 0;
  #lastTick = 0;

  #playing = false;
  #rate = 1;
  #volume = 0.78;
  #frame = 0;
  #listeners = new Set<Listener>();
  #endedListeners = new Set<EndedListener>();
  /** Set by the A–B / line-loop controls; enforced on every tick. */
  #loop: { start: number; end: number } | null = null;

  constructor() {
    this.#tick();
  }

  onUpdate(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  onEnded(listener: EndedListener): () => void {
    this.#endedListeners.add(listener);
    return () => this.#endedListeners.delete(listener);
  }

  loadStream(url: string, durationSec: number): void {
    this.#teardownAudio();
    this.#virtual = false;
    this.#virtualDuration = durationSec;

    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
    audio.volume = this.#volume;
    audio.playbackRate = this.#rate;
    audio.addEventListener('ended', () => {
      this.#playing = false;
      for (const listener of this.#endedListeners) listener();
    });
    this.#audio = audio;
  }

  loadVirtual(durationSec: number): void {
    this.#teardownAudio();
    this.#virtual = true;
    this.#virtualDuration = durationSec;
    this.#virtualPosition = 0;
    this.#lastTick = performance.now();
  }

  async play(): Promise<void> {
    this.#playing = true;
    this.#lastTick = performance.now();
    if (this.#audio) {
      this.#connectAnalyser();
      await this.#audio.play();
    }
  }

  pause(): void {
    this.#playing = false;
    this.#audio?.pause();
  }

  seek(seconds: number): void {
    const clamped = Math.max(0, Math.min(seconds, this.duration || seconds));
    if (this.#audio) {
      this.#audio.currentTime = clamped;
    } else {
      this.#virtualPosition = clamped;
    }
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

  setLoop(loop: { start: number; end: number } | null): void {
    this.#loop = loop;
  }

  get playing(): boolean {
    return this.#playing;
  }

  get position(): number {
    return this.#audio ? this.#audio.currentTime : this.#virtualPosition;
  }

  get duration(): number {
    if (this.#audio && Number.isFinite(this.#audio.duration) && this.#audio.duration > 0) {
      return this.#audio.duration;
    }
    return this.#virtualDuration;
  }

  destroy(): void {
    cancelAnimationFrame(this.#frame);
    this.#teardownAudio();
    void this.#ctx?.close();
    this.#listeners.clear();
    this.#endedListeners.clear();
  }

  #teardownAudio(): void {
    if (this.#audio) {
      this.#audio.pause();
      this.#audio.removeAttribute('src');
      this.#audio.load();
      this.#audio = null;
    }
    this.#analyser = null;
    this.#bins = null;
  }

  #connectAnalyser(): void {
    if (!this.#audio || this.#analyser) return;
    try {
      this.#ctx ??= new AudioContext();
      void this.#ctx.resume();
      const source = this.#ctx.createMediaElementSource(this.#audio);
      const analyser = this.#ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyser.connect(this.#ctx.destination);
      this.#analyser = analyser;
      this.#bins = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    } catch {
      // Cross-origin streams block analysis; the waves fall back to the
      // synthetic level below rather than going flat.
      this.#analyser = null;
    }
  }

  #sampleLevel(now: number): number {
    if (!this.#playing) {
      audioSpectrum.bins.fill(0);
      return 0;
    }
    if (this.#analyser && this.#bins) {
      this.#analyser.getByteFrequencyData(this.#bins);
      let sum = 0;
      const usable = Math.floor(this.#bins.length * 0.6);
      for (let i = 0; i < usable; i += 1) sum += this.#bins[i] ?? 0;
      this.#writeSpectrumFromBins();
      return Math.min(1, sum / usable / 190);
    }
    // Layered sines give the water a musical-looking swell when no analyser
    // is available (demo tracks, cross-origin streams).
    const t = now / 1000;
    const swell = Math.sin(t * 1.7) * 0.35 + Math.sin(t * 0.63 + 1.1) * 0.3 + Math.sin(t * 3.3) * 0.15;
    const level = Math.min(1, Math.max(0, 0.45 + swell * 0.5));
    this.#writeSyntheticSpectrum(now, level);
    return level;
  }

  /** Maps the analyser's low→mid bins across the visualiser strip. */
  #writeSpectrumFromBins(): void {
    const src = this.#bins;
    if (!src) return;
    const dst = audioSpectrum.bins;
    // The upper quarter of an FFT is mostly quiet air for music; spreading the
    // low-mid range across the strip keeps every bar lively.
    const span = Math.max(1, Math.floor(src.length * 0.75));
    for (let i = 0; i < dst.length; i += 1) {
      const idx = Math.floor((i / dst.length) * span);
      dst[i] = src[idx] ?? 0;
    }
    audioSpectrum.real = true;
  }

  /** A bass-heavy, shimmering spectrum so the bars stay musical with no analyser. */
  #writeSyntheticSpectrum(now: number, level: number): void {
    const dst = audioSpectrum.bins;
    const t = now / 1000;
    for (let i = 0; i < dst.length; i += 1) {
      const n = i / dst.length;
      const hump = Math.exp(-((n - 0.15) ** 2) / 0.05);
      const shimmer = 0.5 + 0.5 * Math.sin(t * (2 + n * 6) + i * 0.5);
      dst[i] = Math.max(0, Math.min(255, (hump * 0.7 + 0.3) * shimmer * level * 255));
    }
    audioSpectrum.real = false;
  }

  #emit(): void {
    const state: EngineState = {
      position: this.position,
      duration: this.duration,
      playing: this.#playing,
    };
    for (const listener of this.#listeners) listener(state);
  }

  #tick = (): void => {
    this.#frame = requestAnimationFrame(this.#tick);
    const now = performance.now();

    if (this.#virtual && this.#playing) {
      const delta = (now - this.#lastTick) / 1000;
      this.#virtualPosition = Math.min(
        this.#virtualPosition + delta * this.#rate,
        this.#virtualDuration,
      );
      if (this.#virtualPosition >= this.#virtualDuration) {
        this.#playing = false;
        for (const listener of this.#endedListeners) listener();
      }
    }
    this.#lastTick = now;

    if (this.#loop && this.#playing) {
      const pos = this.position;
      if (pos >= this.#loop.end || pos < this.#loop.start - 0.25) {
        this.seek(this.#loop.start);
      }
    }

    audioLevel.value = this.#sampleLevel(now);
    this.#emit();
  };
}
