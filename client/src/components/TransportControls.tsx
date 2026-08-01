import { usePlayer } from '../state/player';
import { useT } from '../state/settings';
import { Icon } from './Icon';

interface Props {
  size: 'lg' | 'md';
}

export function TransportControls({ size }: Props): JSX.Element {
  const playing = usePlayer((s) => s.playing);
  const status = usePlayer((s) => s.status);
  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const previous = usePlayer((s) => s.previous);
  const queueLength = usePlayer((s) => s.queue.length);
  const t = useT();

  const loading = status === 'loading';
  const iconSize = size === 'lg' ? 18 : 16;

  return (
    <div className={`transport transport--${size}`}>
      <button type="button" className="transport__side" onClick={previous} aria-label="Назад">
        <Icon name="prev" size={size === 'lg' ? 15 : 13} />
      </button>
      <button
        type="button"
        className="transport__main"
        onClick={toggle}
        disabled={loading || status === 'idle'}
        aria-label={playing ? t('pause') : t('play')}
      >
        {loading ? (
          <span className="spinner spinner--dark" />
        ) : (
          <Icon name={playing ? 'pause' : 'play'} size={iconSize} />
        )}
      </button>
      <button
        type="button"
        className="transport__side"
        onClick={next}
        disabled={queueLength === 0}
        aria-label="Вперёд"
      >
        <Icon name="next" size={size === 'lg' ? 15 : 13} />
      </button>
    </div>
  );
}
