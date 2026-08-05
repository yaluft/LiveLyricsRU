import type { WaveTheme } from '@lyrika/shared';
import { audioLevel, audioSpectrum } from '../audio/level';

/**
 * An original audio-reactive "music waves" background. It reads the shared
 * spectrum published by the playback engine and draws a set of layered,
 * mirrored ribbons whose amplitude follows the frequency bins — a smooth,
 * flowing waveform rather than hard bars. Pure Canvas 2D: no WebGL, no external
 * asset, and it degrades to a gently shimmering idle wave when no audio
 * analyser is available (demo or cross-origin streams).
 */
export interface VisualizerOptions {
  theme: WaveTheme;
  /** 0..~2, scales the ribbon height. */
  waveHeight: number;
  /** 0..1, how strongly the ribbon reacts to the audio spectrum. */
  reactivity: number;
}

/** Number of layered ribbons drawn back-to-front for depth. */
const LAYERS = 3;

export class VisualizerRenderer {
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D;
  #opts: VisualizerOptions;
  #frame = 0;
  #width = 0;
  #height = 0;
  #dpr = 1;
  // Per-bin smoothed magnitude (0..1), so the ribbon eases between frames
  // instead of snapping on every analyser sample.
  #smooth: Float32Array;
  #phase = 0;

  constructor(canvas: HTMLCanvasElement, opts: VisualizerOptions) {
    this.#canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.#ctx = ctx;
    this.#opts = opts;
    this.#smooth = new Float32Array(audioSpectrum.bins.length);
    this.#frame = requestAnimationFrame(this.#tick);
  }

  update(opts: Partial<VisualizerOptions>): void {
    this.#opts = { ...this.#opts, ...opts };
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.#dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.#width = cssWidth;
    this.#height = cssHeight;
    this.#canvas.width = Math.max(1, Math.round(cssWidth * this.#dpr));
    this.#canvas.height = Math.max(1, Math.round(cssHeight * this.#dpr));
    this.#ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
  }

  dispose(): void {
    cancelAnimationFrame(this.#frame);
  }

  #tick = (): void => {
    this.#frame = requestAnimationFrame(this.#tick);
    if (this.#width === 0 || this.#height === 0) return;
    this.#draw();
  };

  #draw(): void {
    const ctx = this.#ctx;
    const w = this.#width;
    const h = this.#height;
    const { theme, reactivity } = this.#opts;

    // Ease each bin toward its current magnitude. Falls are slower than rises,
    // which reads as "settling" and looks more musical than a symmetric ease.
    const bins = audioSpectrum.bins;
    const smooth = this.#smooth;
    for (let i = 0; i < smooth.length; i += 1) {
      const target = (bins[i] ?? 0) / 255;
      const prev = smooth[i] ?? 0;
      const rate = target > prev ? 0.4 : 0.12;
      smooth[i] = prev + (target - prev) * rate;
    }

    this.#phase += 0.006 + audioLevel.value * 0.01;

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    const baseY = h * 0.6;
    const amp = h * 0.16 * this.#opts.waveHeight * (0.4 + reactivity);
    const colors = [theme.atmosphere, theme.surface, theme.atmosphere];

    for (let layer = 0; layer < LAYERS; layer += 1) {
      const depth = layer / (LAYERS - 1); // 0 (back) .. 1 (front)
      const layerAmp = amp * (0.55 + depth * 0.65);
      const layerY = baseY + (0.5 - depth) * h * 0.05;
      const alpha = 0.10 + depth * 0.16;
      const phase = this.#phase * (0.7 + depth * 0.6) + layer * 1.7;
      const color = colors[layer % colors.length] ?? theme.atmosphere;

      this.#ribbon(layerY, layerAmp, phase, depth, color, alpha);
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  /** Draws one filled, mirrored ribbon following the smoothed spectrum. */
  #ribbon(
    centerY: number,
    amp: number,
    phase: number,
    depth: number,
    color: string,
    alpha: number,
  ): void {
    const ctx = this.#ctx;
    const w = this.#width;
    const smooth = this.#smooth;
    const n = smooth.length;
    const steps = 96;

    const heightAt = (x: number): number => {
      // Sample the spectrum symmetrically so bass sits centre-screen and the
      // ribbon mirrors left↔right, then add a travelling swell for motion.
      const t = x / w; // 0..1
      const mirrored = t < 0.5 ? t * 2 : (1 - t) * 2; // 0..1..0
      const idx = Math.min(n - 1, Math.floor(mirrored * (n - 1)));
      const mag = smooth[idx] ?? 0;
      const travel = Math.sin(t * Math.PI * 3 + phase) * 0.5 + 0.5;
      // Taper the ends so the ribbon fades into the edges of the screen.
      const edge = Math.sin(t * Math.PI);
      return (mag * 0.8 + 0.08) * (0.5 + travel * 0.5) * edge * amp;
    };

    const top: [number, number][] = [];
    const bottom: [number, number][] = [];
    for (let i = 0; i <= steps; i += 1) {
      const x = (i / steps) * w;
      const dy = heightAt(x);
      top.push([x, centerY - dy]);
      bottom.push([x, centerY + dy]);
    }

    ctx.beginPath();
    ctx.moveTo(top[0]?.[0] ?? 0, top[0]?.[1] ?? centerY);
    for (const [x, y] of top) ctx.lineTo(x, y);
    for (let i = bottom.length - 1; i >= 0; i -= 1) {
      const p = bottom[i];
      if (p) ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, centerY - amp, 0, centerY + amp);
    grad.addColorStop(0, this.#rgba(color, 0));
    grad.addColorStop(0.5, this.#rgba(color, alpha));
    grad.addColorStop(1, this.#rgba(color, 0));
    ctx.fillStyle = grad;
    ctx.shadowColor = this.#rgba(color, alpha * 0.8);
    ctx.shadowBlur = 24 * depth;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  /** Converts a #rrggbb theme colour to an rgba() string at the given alpha. */
  #rgba(hex: string, alpha: number): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m || !m[1]) return `rgba(120, 200, 255, ${alpha})`;
    const int = parseInt(m[1], 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
