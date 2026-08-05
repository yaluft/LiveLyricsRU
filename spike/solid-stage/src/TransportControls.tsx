import type { JSX } from 'solid-js';
import { playerState, toggle } from './store';

interface Props {
  size: 'lg' | 'md';
}

/**
 * Solid port of client/src/components/TransportControls.tsx. Queue is out of
 * scope for this spike, so prev/next stay visually present but inert.
 *
 * NOTE the props access below: `props.size`, never `const { size } = props`.
 * Destructuring at the top of the component reads `size` once at call time
 * and detaches it from Solid's reactivity — see docs/frontend-framework-
 * comparison.md for the before/after on this exact component.
 */
export function TransportControls(props: Props): JSX.Element {
  const loading = () => playerState.status === 'loading';
  const iconSize = () => (props.size === 'lg' ? 18 : 16);

  return (
    <div class={`transport transport--${props.size}`}>
      <button type="button" class="transport__side" disabled aria-label="Назад">
        ⏮
      </button>
      <button
        type="button"
        class="transport__main"
        onClick={toggle}
        disabled={loading() || playerState.status === 'idle'}
        aria-label={playerState.playing ? 'Пауза' : 'Играть'}
      >
        {loading() ? (
          <span class="spinner spinner--dark" />
        ) : (
          <span style={{ 'font-size': `${iconSize()}px` }}>{playerState.playing ? '⏸' : '▶'}</span>
        )}
      </button>
      <button type="button" class="transport__side" disabled aria-label="Вперёд">
        ⏭
      </button>
    </div>
  );
}
