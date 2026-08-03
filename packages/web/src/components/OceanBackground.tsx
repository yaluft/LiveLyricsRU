import { createEffect, createSignal, onCleanup, onMount, Show, type JSX } from 'solid-js';
import type { OceanRenderer } from '../bg/ocean.js';
import { oceanParams, settings } from '../state/settings.js';

/**
 * Mounts the WebGL ocean, or a CSS stand-in when WebGL is unavailable or eco
 * mode is on. Never unmounts between views — it is the shell everything else
 * sits inside.
 */
export function OceanBackground(): JSX.Element {
  let canvas: HTMLCanvasElement | undefined;
  let renderer: OceanRenderer | undefined;
  const [supported, setSupported] = createSignal(true);

  const [tick, setTick] = createSignal(0);

  onMount(() => {
    let observer: ResizeObserver | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    // three.js is ~400 kB of the bundle and is needed only when the WebGL path
    // actually runs. Importing it here means eco mode and any browser without
    // WebGL never download it at all.
    void (async () => {
      const { OceanRenderer, webglAvailable } = await import('../bg/ocean.js');

      if (cancelled) return;
      if (settings.ecoMode || !webglAvailable() || !canvas) {
        setSupported(false);
        return;
      }

      renderer = new OceanRenderer(canvas, oceanParams(0));

      observer = new ResizeObserver(([entry]) => {
        const rect = entry?.contentRect;
        if (rect) renderer?.resize(rect.width, rect.height);
      });
      observer.observe(canvas.parentElement ?? canvas);
      renderer.resize(window.innerWidth, window.innerHeight);

      // A second, slow ticker so animated themes advance. The renderer has its
      // own 60 fps loop; this only re-resolves theme colours, and doing that
      // per frame would be sixty pointless interpolations a second.
      timer = setInterval(() => setTick((value) => value + 1), 1000);
    })();

    onCleanup(() => {
      cancelled = true;
      if (timer !== undefined) clearInterval(timer);
      observer?.disconnect();
      renderer?.dispose();
      renderer = undefined;
    });
  });

  createEffect(() => {
    tick();
    // Reading the whole override object keeps this effect subscribed to every
    // slider, so a change to any parameter pushes new uniforms immediately.
    void settings.oceanOverrides;
    void settings.themeId;
    renderer?.update(oceanParams(renderer.elapsedSec()));
  });

  return (
    <div class="fixed inset-0 -z-10 overflow-hidden bg-[--ocean-sky]">
      <Show
        when={supported()}
        fallback={
          // Eco / no-WebGL: two soft arcs suggesting water without a GL context.
          <div
            class="absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 80% at 50% 110%, var(--ocean-surface) 0%, transparent 60%),' +
                'radial-gradient(90% 60% at 50% 100%, var(--ocean-atmosphere) 0%, transparent 55%)',
            }}
          />
        }
      >
        <canvas ref={canvas} class="h-full w-full" />
      </Show>
    </div>
  );
}
