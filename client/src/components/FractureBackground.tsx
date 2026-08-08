import { useEffect, useRef } from 'react';
import { WAVE_THEMES } from '@lyrika/shared';
import { FractureRenderer } from '../bg/fracture';
import { webglAvailable } from '../bg/ocean';
import { useSettings } from '../state/settings';

export function FractureBackground(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FractureRenderer | null>(null);

  const preset = useSettings((s) => s.wavePreset);
  const waveHeight = useSettings((s) => s.waveHeight);
  const reactivity = useSettings((s) => s.reactivity);
  const ecoMode = useSettings((s) => s.ecoMode);

  const theme = WAVE_THEMES[preset];
  const use3d = !ecoMode;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!use3d || !canvas || !webglAvailable()) return;

    const renderer = new FractureRenderer(canvas, {
      theme: WAVE_THEMES[useSettings.getState().wavePreset],
      waveHeight: useSettings.getState().waveHeight,
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
  }, [use3d]);

  useEffect(() => {
    rendererRef.current?.update({ theme, waveHeight, reactivity });
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
      {use3d ? (
        <canvas ref={canvasRef} className="ocean__canvas" />
      ) : (
        <>
          <div className="ocean__arc ocean__arc--far" />
          <div className="ocean__arc ocean__arc--near" />
        </>
      )}
      <div className="ocean__scrim" />
    </div>
  );
}
