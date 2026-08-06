import { useEffect, useRef } from 'react';
import { WAVE_THEMES } from '@lyrika/shared';
import { VisualizerRenderer } from '../bg/visualizer';
import { useSettings } from '../state/settings';

/**
 * Music-wave visualizer background. Shares the `.ocean` wrapper (sky + scrim) so
 * it slots in wherever the ocean did, but paints an audio-reactive waveform on a
 * 2D canvas instead of the WebGL sea.
 */
export function Visualizer(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<VisualizerRenderer | null>(null);

  const preset = useSettings((s) => s.wavePreset);
  const waveHeight = useSettings((s) => s.waveHeight);
  const reactivity = useSettings((s) => s.reactivity);

  const theme = WAVE_THEMES[preset];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new VisualizerRenderer(canvas, {
      theme: WAVE_THEMES[useSettings.getState().wavePreset],
      waveHeight: useSettings.getState().waveHeight * 1.6,
      reactivity: useSettings.getState().reactivity,
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
  }, []);

  useEffect(() => {
    rendererRef.current?.update({ theme, waveHeight: waveHeight * 1.6, reactivity });
  }, [theme, waveHeight, reactivity]);

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
