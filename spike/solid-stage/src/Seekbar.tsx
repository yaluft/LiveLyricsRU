import type { JSX } from 'solid-js';
import { onCleanup } from 'solid-js';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface Props {
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
}

/** Solid port of client/src/components/Seekbar.tsx (A–B markers dropped — out of scope). */
export function Seekbar(props: Props): JSX.Element {
  let ref: HTMLDivElement | undefined;

  const safeDuration = () => (props.duration > 0 ? props.duration : 1);
  const percent = () => clamp((props.position / safeDuration()) * 100, 0, 100);

  const seekFromEvent = (clientX: number) => {
    if (!ref) return;
    const rect = ref.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    props.onSeek(ratio * safeDuration());
  };

  onCleanup(() => {
    ref = undefined;
  });

  return (
    <div
      ref={ref}
      class="seek"
      role="slider"
      tabIndex={0}
      aria-label="Позиция в треке"
      aria-valuemin={0}
      aria-valuemax={Math.round(safeDuration())}
      aria-valuenow={Math.round(props.position)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        seekFromEvent(event.clientX);
      }}
      onPointerMove={(event) => {
        if (event.buttons === 1) seekFromEvent(event.clientX);
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') props.onSeek(Math.max(0, props.position - 5));
        if (event.key === 'ArrowRight') props.onSeek(Math.min(safeDuration(), props.position + 5));
      }}
    >
      <div class="seek__fill" style={{ width: `${percent()}%` }} />
      <div class="seek__thumb" style={{ left: `${percent()}%` }} />
    </div>
  );
}
