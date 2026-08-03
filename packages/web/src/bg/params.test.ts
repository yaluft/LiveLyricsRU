import { describe, expect, it } from 'vitest';
import { resolveTheme, THEMES, themeById, type OceanTheme } from './params.js';

describe('themeById', () => {
  it('finds a theme', () => {
    expect(themeById('night').name).toBe('Ночь');
  });

  it('falls back to the first theme rather than returning undefined', () => {
    // Settings persist across builds; a theme id that no longer exists must not
    // leave the renderer with no parameters at all.
    expect(themeById('deleted-theme').id).toBe(THEMES[0]!.id);
  });
});

describe('resolveTheme', () => {
  const still = THEMES.find((theme) => !theme.keyframes)!;
  const animated = THEMES.find((theme) => theme.keyframes)!;

  it('returns the base unchanged for a theme with no keyframes', () => {
    expect(resolveTheme(still, 0)).toEqual(still.base);
    expect(resolveTheme(still, 9_999)).toEqual(still.base);
  });

  it('lands on the first keyframe at the start of the cycle', () => {
    const first = animated.keyframes![0]!;
    const resolved = resolveTheme(animated, 0);
    expect(resolved.fog).toBe(first.values.fog);
  });

  it('actually moves through the cycle', () => {
    const start = resolveTheme(animated, 0);
    const middle = resolveTheme(animated, (animated.cycleSec ?? 600) * 0.45);

    expect(middle.fog).not.toBe(start.fog);
  });

  it('is cyclic — one full period returns to the start', () => {
    const cycle = animated.cycleSec ?? 600;
    expect(resolveTheme(animated, 0).fog).toBe(resolveTheme(animated, cycle).fog);
  });

  it('interpolates colours to a valid hex, never to NaN', () => {
    for (let t = 0; t < 1; t += 0.05) {
      const resolved = resolveTheme(animated, (animated.cycleSec ?? 600) * t);
      expect(resolved.fog, `t=${t}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(resolved.surface, `t=${t}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(resolved.atmosphere, `t=${t}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('interpolates numeric parameters within the keyframe range', () => {
    const values = animated
      .keyframes!.map((frame) => frame.values.lightElevation)
      .filter((value): value is number => value !== undefined);
    const min = Math.min(...values);
    const max = Math.max(...values);

    for (let t = 0; t < 1; t += 0.1) {
      const resolved = resolveTheme(animated, (animated.cycleSec ?? 600) * t);
      expect(resolved.lightElevation).toBeGreaterThanOrEqual(min - 1e-6);
      expect(resolved.lightElevation).toBeLessThanOrEqual(max + 1e-6);
    }
  });

  it('handles a negative elapsed time without leaving the cycle', () => {
    const resolved = resolveTheme(animated, -50);
    expect(resolved.fog).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('leaves parameters no keyframe mentions at their base value', () => {
    const resolved = resolveTheme(animated, (animated.cycleSec ?? 600) * 0.5);
    expect(resolved.foamAmount).toBe(animated.base.foamAmount);
  });

  it('degrades to the base when a theme has only one keyframe', () => {
    const single: OceanTheme = {
      id: 'x',
      name: 'x',
      base: still.base,
      keyframes: [{ at: 0, values: { fog: '#ffffff' } }],
    };
    expect(resolveTheme(single, 10)).toEqual(still.base);
  });
});
