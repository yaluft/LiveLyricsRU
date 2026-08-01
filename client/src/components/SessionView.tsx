import { useState } from 'react';
import { usePlayer } from '../state/player';
import { useT } from '../state/settings';
import { useUi } from '../state/ui';

function makeCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function SessionView(): JSX.Element {
  const t = useT();
  const [code, setCode] = useState<string | null>(null);
  const toast = useUi((s) => s.toast);
  const track = usePlayer((s) => s.track);
  const queue = usePlayer((s) => s.queue);

  return (
    <section className="view scroll-y">
      <header className="view__head">
        <h1 className="view__title">{t('sessionTitle')}</h1>
      </header>

      <section className="card">
        <span className="card__body">{t('sessionBlurb')}</span>

        {code ? (
          <div className="session">
            <span className="label">Код комнаты</span>
            <span className="session__code mono">{code}</span>
            <button
              type="button"
              className="btn"
              onClick={() => {
                void navigator.clipboard?.writeText(code);
                toast('Код скопирован', 'success');
              }}
            >
              Скопировать
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => setCode(makeCode())}>
            {t('sessionCreate')}
          </button>
        )}

        <div className="session__state">
          <span className="mono">
            {track ? `${track.artist} — ${track.title}` : t('nothingPlaying')}
          </span>
          <span className="mono">
            {t('navQueue')}: {queue.length}
          </span>
        </div>

        <span className="card__note mono">{t('sessionSimulated')}</span>
      </section>
    </section>
  );
}
