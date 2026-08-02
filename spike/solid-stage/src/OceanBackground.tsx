import { onCleanup, onMount, type JSX } from 'solid-js';
import { WAVE_THEMES } from '@lyrika/shared';
import { OceanRenderer, webglAvailable } from './bg/ocean';

const THEME = WAVE_THEMES.calm;

/**
 * Solid port of client/src/components/OceanBackground.tsx. React's
 * `useRef` + `useEffect(() => { ...; return cleanup }, [])` maps almost 1:1
 * onto Solid's `let canvas!: HTMLCanvasElement` (bound via `ref`) plus
 * `onMount` / `onCleanup` — no dependency array to get wrong, since `onMount`
 * only ever runs once by definition.
 *
 * This mounts the copied, unmodified `ocean.ts`, which reads the shared
 * `audioLevel.value` object every frame in its own rAF loop — entirely
 * outside Solid's signal graph, same as it's outside React's state today.
 * That's done criterion #4: it should animate and never fight Solid's own
 * rendering.
 */
export function OceanBackground(): JSX.Element {
  let canvas!: HTMLCanvasElement;
  let renderer: OceanRenderer | null = null;
  let observer: ResizeObserver | null = null;

  onMount(() => {
    if (!webglAvailable()) return;

    renderer = new OceanRenderer(canvas, {
      theme: THEME,
      waveHeight: 0.62 * 3.2,
      reactivity: 0.45,
    });

    const resize = () => renderer?.resize(canvas.clientWidth, canvas.clientHeight);
    resize();
    observer = new ResizeObserver(resize);
    observer.observe(canvas);
  });

  onCleanup(() => {
    observer?.disconnect();
    renderer?.dispose();
    renderer = null;
  });

  return (
    <div
      class="ocean"
      aria-hidden="true"
      style={{
        '--fog': THEME.fog,
        '--surface': THEME.surface,
        '--atmosphere': THEME.atmosphere,
      }}
    >
      <div class="ocean__sky" />
      <canvas ref={canvas} class="ocean__canvas" />
      <div class="ocean__scrim" />
    </div>
  );
}
