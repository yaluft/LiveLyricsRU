import { useCallback, useRef } from 'react';
import { clamp } from '../utils';

interface Props {
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
  thin?: boolean;
  /** A–B loop markers drawn over the track, in seconds. */
  markers?: { a: number; b: number | null } | null;
}

export function Seekbar({ position, duration, onSeek, thin, markers }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const safeDuration = duration > 0 ? duration : 1;
  const percent = clamp((position / safeDuration) * 100, 0, 100);

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      onSeek(ratio * safeDuration);
    },
    [onSeek, safeDuration],
  );

  return (
    <div
      ref={ref}
      className={`seek${thin ? ' seek--thin' : ''}`}
      role="slider"
      tabIndex={0}
      aria-label="Позиция в треке"
      aria-valuemin={0}
      aria-valuemax={Math.round(safeDuration)}
      aria-valuenow={Math.round(position)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        seekFromEvent(event.clientX);
      }}
      onPointerMove={(event) => {
        if (event.buttons === 1) seekFromEvent(event.clientX);
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') onSeek(Math.max(0, position - 5));
        if (event.key === 'ArrowRight') onSeek(Math.min(safeDuration, position + 5));
      }}
    >
      <div className="seek__fill" style={{ width: `${percent}%` }} />
      {markers ? (
        <>
          <div
            className="seek__marker"
            style={{ left: `${clamp((markers.a / safeDuration) * 100, 0, 100)}%` }}
          />
          {markers.b !== null ? (
            <div
              className="seek__marker"
              style={{ left: `${clamp((markers.b / safeDuration) * 100, 0, 100)}%` }}
            />
          ) : null}
        </>
      ) : null}
      <div className="seek__thumb" style={{ left: `${percent}%` }} />
    </div>
  );
}
