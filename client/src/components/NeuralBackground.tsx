import { useEffect, useRef } from 'react';
import { WAVE_THEMES } from '@lyrika/shared';
import { NeuralRenderer } from '../bg/neural';
import { useSettings } from '../state/settings';
import { MOBILE_QUERY, useMediaQuery } from '../hooks';

/**
 * "Neural network" audio-reactive background. Shares the `.ocean` wrapper
 * (sky + scrim) so it slots in wherever the ocean did, but paints a
 * constellation of pulsing, connecting nodes on a 2D canvas instead.
 */
export function NeuralBackground(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<NeuralRenderer | null>(null);

  const preset = useSettings((s) => s.wavePreset);
  const waveHeight = useSettings((s) => s.waveHeight);
  const reactivity = useSettings((s) => s.reactivity);
  const ecoMode = useSettings((s) => s.ecoMode);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  const theme = WAVE_THEMES[preset];
  const compact = ecoMode || isMobile;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new NeuralRenderer(canvas, {
      theme: WAVE_THEMES[useSettings.getState().wavePreset],
      waveHeight: useSettings.getState().waveHeight * 1.6,
      reactivity: useSettings.getState().reactivity,
      compact,
    });
    rendererRef.current = renderer;

    const resize = () => renderer.resize(canvas.clientWidth, canvas.clientHeight);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rendererRef.current?.update({ theme, waveHeight: waveHeight * 1.6, reactivity, compact });
  }, [theme, waveHeight, reactivity, compact]);

  return (
    <div
      className="ocean"
      aria-hidden
      style={
        {
          '--fog': theme.fog,
          '--surface': theme.surface,
          '--atmosphere': theme.atmosphere,
        } as React.CSSProperties
      }
    >
      <div className="ocean__sky" />
      <canvas ref={canvasRef} className="ocean__canvas" />
      <div className="ocean__scrim" />
    </div>
  );
}
