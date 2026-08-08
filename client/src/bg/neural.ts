import type { WaveTheme } from '@lyrika/shared';
import { audioLevel, audioSpectrum } from '../audio/level';

/**
 * "Neural Network" background: a constellation of nodes drifting slowly
 * across the stage, connected by thin lines when close enough — each node
 * permanently tracks one frequency bin, so the whole net visibly lights up
 * and thickens with connections during loud/dense parts of the track. Pure
 * Canvas 2D, following the same lightweight approach as `visualizer.ts`, so
 * it's eco/mobile-safe by construction.
 */
export interface NeuralOptions {
  theme: WaveTheme;
  /** 0..~2, scales node size and edge brightness. */
  waveHeight: number;
  /** 0..1, how strongly nodes/edges react to the audio spectrum. */
  reactivity: number;
  /** Fewer nodes and lighter glow for mobile/low-power devices. */
  compact: boolean;
}

const NODE_COUNT_FULL = 52;
const NODE_COUNT_COMPACT = 24;

interface NeuralNode {
  bx: number; // base position, fraction of width/height (0..1)
  by: number;
  driftX: number; // drift radius, fraction of width/height
  driftY: number;
  freqX: number;
  freqY: number;
  phaseX: number;
  phaseY: number;
  bin: number; // fixed index into audioSpectrum.bins this node tracks
  x: number; // resolved position in CSS px, updated every frame
  y: number;
}

export class NeuralRenderer {
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D;
  #opts: NeuralOptions;
  #frame = 0;
  #width = 0;
  #height = 0;
  #dpr = 1;
  #start = performance.now();
  #nodes: NeuralNode[];
  #smooth: Float32Array;

  constructor(canvas: HTMLCanvasElement, opts: NeuralOptions) {
    this.#canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.#ctx = ctx;
    this.#opts = opts;
    this.#smooth = new Float32Array(audioSpectrum.bins.length);
    this.#nodes = this.#makeNodes(opts.compact);
    this.#frame = requestAnimationFrame(this.#tick);
  }

  update(opts: Partial<NeuralOptions>): void {
    const compactChanged = opts.compact !== undefined && opts.compact !== this.#opts.compact;
    this.#opts = { ...this.#opts, ...opts };
    if (compactChanged) this.#nodes = this.#makeNodes(this.#opts.compact);
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

  #makeNodes(compact: boolean): NeuralNode[] {
    const count = compact ? NODE_COUNT_COMPACT : NODE_COUNT_FULL;
    const bins = audioSpectrum.bins.length;
    const nodes: NeuralNode[] = [];
    for (let i = 0; i < count; i += 1) {
      nodes.push({
        bx: 0.06 + Math.random() * 0.88,
        by: 0.06 + Math.random() * 0.88,
        driftX: 0.03 + Math.random() * 0.05,
        driftY: 0.03 + Math.random() * 0.05,
        freqX: 0.12 + Math.random() * 0.22,
        freqY: 0.12 + Math.random() * 0.22,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        bin: Math.floor((i / count) * bins),
        x: 0,
        y: 0,
      });
    }
    return nodes;
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
    const { theme, waveHeight, reactivity, compact } = this.#opts;
    const t = (performance.now() - this.#start) / 1000;

    // Ease each bin toward its current magnitude, same "settle" feel as the
    // equalizer visualizer, so the net pulses musically rather than jittering.
    const bins = audioSpectrum.bins;
    const smooth = this.#smooth;
    for (let i = 0; i < smooth.length; i += 1) {
      const target = ((bins[i] ?? 0) / 255) * reactivity;
      const prev = smooth[i] ?? 0;
      const rate = target > prev ? 0.4 : 0.12;
      smooth[i] = prev + (target - prev) * rate;
    }

    const globalLevel = audioLevel.value * reactivity;

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    for (const node of this.#nodes) {
      node.x = node.bx * w + Math.sin(t * node.freqX + node.phaseX) * node.driftX * w;
      node.y = node.by * h + Math.cos(t * node.freqY + node.phaseY) * node.driftY * h;
    }

    const connectRadius = Math.min(w, h) * (compact ? 0.22 : 0.28);
    const baseNodeRadius = (compact ? 1.6 : 2.1) * waveHeight;

    // Edges first so nodes glow on top of their own connections.
    for (let i = 0; i < this.#nodes.length; i += 1) {
      const a = this.#nodes[i];
      if (!a) continue;
      const magA = smooth[a.bin] ?? 0;
      for (let j = i + 1; j < this.#nodes.length; j += 1) {
        const b = this.#nodes[j];
        if (!b) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > connectRadius) continue;

        const magB = smooth[b.bin] ?? 0;
        const avgMag = (magA + magB) * 0.5;
        const proximity = 1 - dist / connectRadius;
        const alpha = (0.03 + avgMag * 0.5) * proximity;
        if (alpha <= 0.01) continue;

        ctx.strokeStyle = this.#rgba(theme.atmosphere, alpha);
        ctx.lineWidth = 0.5 + avgMag * 2.2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // Nodes on top, size/brightness pulsing with their own bin plus the
    // track's overall loudness.
    for (const node of this.#nodes) {
      const mag = smooth[node.bin] ?? 0;
      const radius = baseNodeRadius * (0.7 + mag * 2.2) * (0.85 + globalLevel * 0.5);
      const alpha = 0.35 + mag * 0.55 + globalLevel * 0.1;
      const color = node.bin % 2 === 0 ? theme.atmosphere : theme.surface;

      ctx.fillStyle = this.#rgba(color, Math.min(1, alpha));
      ctx.shadowColor = this.#rgba(color, Math.min(1, alpha * 0.8));
      ctx.shadowBlur = compact ? 6 : 12;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
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
