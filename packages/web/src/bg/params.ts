/**
 * Every value the ocean renderer reads, all of it user-adjustable.
 *
 * v2 exposed three of these (height, reactivity, blur) and hardcoded the rest —
 * including the light direction, which is the parameter that actually decides
 * whether the water reads as dawn or as midnight.
 */
export interface OceanParams {
  /** Overall wave amplitude multiplier. */
  height: number;
  /** Gerstner steepness. Past ~1.0 the crests self-intersect and curl. */
  steepness: number;
  /** Wind heading in radians; every wave train is offset around it. */
  windDirection: number;
  /** Time multiplier — how fast the whole surface advances. */
  windSpeed: number;
  /** Spread of the wave trains around the wind heading. 0 = all parallel. */
  choppiness: number;
  /** Crest steepness at which foam starts appearing. */
  foamThreshold: number;
  foamAmount: number;

  fog: string;
  surface: string;
  atmosphere: string;

  /** Light direction in radians: azimuth around the horizon, elevation above it. */
  lightAzimuth: number;
  lightElevation: number;
  specularPower: number;
  specularStrength: number;

  /** How much the audio level drives amplitude and sparkle. */
  reactivity: number;
  /** Backdrop blur behind the lyric column, in pixels. */
  lyricBlur: number;
}

export interface OceanKeyframe {
  /** Position in the cycle, 0–1. */
  at: number;
  values: Partial<OceanParams>;
}

export interface OceanTheme {
  id: string;
  name: string;
  base: OceanParams;
  /**
   * Optional drift through the cycle. A theme stops being a static colour
   * triple and becomes something that moves — a slow dusk into night — which
   * is what makes a background worth looking at for the length of an album.
   */
  keyframes?: OceanKeyframe[];
  /** Seconds for one full cycle. */
  cycleSec?: number;
}

const BASE: OceanParams = {
  height: 0.62,
  steepness: 0.55,
  windDirection: 0.32,
  windSpeed: 1,
  choppiness: 0.6,
  foamThreshold: 0.62,
  foamAmount: 0.5,
  fog: '#001a2e',
  surface: '#0a5c8a',
  atmosphere: '#4fd2ff',
  lightAzimuth: 2.2,
  lightElevation: 0.6,
  specularPower: 48,
  specularStrength: 0.35,
  reactivity: 0.45,
  lyricBlur: 28,
};

export const THEMES: OceanTheme[] = [
  {
    id: 'calm',
    name: 'Штиль',
    base: { ...BASE },
  },
  {
    id: 'surf',
    name: 'Прибой',
    base: {
      ...BASE,
      height: 1.05,
      steepness: 0.85,
      windSpeed: 1.35,
      choppiness: 0.9,
      foamThreshold: 0.5,
      foamAmount: 0.85,
      fog: '#00121f',
      surface: '#0d7fd0',
      atmosphere: '#7fe4ff',
    },
  },
  {
    id: 'night',
    name: 'Ночь',
    base: {
      ...BASE,
      height: 0.5,
      steepness: 0.45,
      fog: '#050a18',
      surface: '#2a1a6a',
      atmosphere: '#8f7fff',
      lightAzimuth: 1.1,
      lightElevation: 0.28,
      specularPower: 90,
      specularStrength: 0.5,
    },
  },
  {
    id: 'lagoon',
    name: 'Лагуна',
    base: {
      ...BASE,
      height: 0.4,
      steepness: 0.35,
      windSpeed: 0.7,
      fog: '#0b1a12',
      surface: '#0f8a6a',
      atmosphere: '#5fffd0',
      lightElevation: 0.85,
    },
  },
  {
    id: 'dusk',
    name: 'Закат',
    base: {
      ...BASE,
      height: 0.72,
      fog: '#1a0a1e',
      surface: '#b04a5a',
      atmosphere: '#ffb37f',
      lightAzimuth: 3.0,
      lightElevation: 0.12,
      specularPower: 120,
      specularStrength: 0.7,
    },
    // Drifts from sunset into night and back over twenty minutes.
    cycleSec: 1200,
    keyframes: [
      { at: 0, values: { fog: '#1a0a1e', surface: '#b04a5a', atmosphere: '#ffb37f', lightElevation: 0.12 } },
      { at: 0.45, values: { fog: '#0a0716', surface: '#4a2a6a', atmosphere: '#c08fff', lightElevation: 0.02 } },
      { at: 0.7, values: { fog: '#050a18', surface: '#2a1a6a', atmosphere: '#8f7fff', lightElevation: 0.3 } },
      { at: 1, values: { fog: '#1a0a1e', surface: '#b04a5a', atmosphere: '#ffb37f', lightElevation: 0.12 } },
    ],
  },
];

export function themeById(id: string): OceanTheme {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0]!;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex([lerp(ar, br, t), lerp(ag, bg, t), lerp(ab, bb, t)]);
}

const COLOUR_KEYS = new Set(['fog', 'surface', 'atmosphere']);

/**
 * Resolves a theme at a point in its cycle, easing between keyframes.
 * Colours interpolate in RGB and numbers linearly; a theme with no keyframes
 * simply returns its base.
 */
export function resolveTheme(theme: OceanTheme, elapsedSec: number): OceanParams {
  const frames = theme.keyframes;
  if (!frames || frames.length < 2) return theme.base;

  const cycle = theme.cycleSec ?? 600;
  const phase = ((elapsedSec / cycle) % 1 + 1) % 1;

  let from = frames[0]!;
  let to = frames[frames.length - 1]!;
  for (let i = 0; i < frames.length - 1; i += 1) {
    if (phase >= frames[i]!.at && phase <= frames[i + 1]!.at) {
      from = frames[i]!;
      to = frames[i + 1]!;
      break;
    }
  }

  const span = to.at - from.at;
  const raw = span <= 0 ? 0 : (phase - from.at) / span;
  // Smoothstep, so a keyframe boundary is not a visible kink in the drift.
  const t = raw * raw * (3 - 2 * raw);

  const out: OceanParams = { ...theme.base };
  for (const key of Object.keys(to.values) as (keyof OceanParams)[]) {
    const a = from.values[key] ?? theme.base[key];
    const b = to.values[key] ?? theme.base[key];
    if (COLOUR_KEYS.has(key)) {
      (out[key] as string) = lerpHex(String(a), String(b), t);
    } else if (typeof a === 'number' && typeof b === 'number') {
      (out[key] as number) = lerp(a, b, t);
    }
  }
  return out;
}
