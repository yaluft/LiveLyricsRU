import { useEffect, useState } from 'react';
import type { Track } from '@lyrika/shared';
import { api } from '../api';
import { usePlayer } from '../state/player';
import { useT } from '../state/settings';
import { useUi } from '../state/ui';
import { formatTime } from '../utils';
import { Artwork } from './Artwork';

export function QueueView(): JSX.Element {
  const t = useT();
  const track = usePlayer((s) => s.track);
  const queue = usePlayer((s) => s.queue);
  const playing = usePlayer((s) => s.playing);
  const playTrack = usePlayer((s) => s.playTrack);
  const dequeue = usePlayer((s) => s.dequeue);
  const clearQueue = usePlayer((s) => s.clearQueue);
  const enqueue = usePlayer((s) => s.enqueue);
  const enqueueAll = usePlayer((s) => s.enqueueAll);
  const openSearch = useUi((s) => s.openSearch);

  const [related, setRelated] = useState<Track[]>([]);

  useEffect(() => {
    if (!track) {
      setRelated([]);
      return;
    }
    let cancelled = false;
    api
      .search(track.artist)
      .then((response) => {
        if (cancelled) return;
        setRelated(response.results.filter((r) => r.id !== track.id).slice(0, 4));
      })
      .catch(() => setRelated([]));
    return () => {
      cancelled = true;
    };
  }, [track]);

  return (
    <section className="view view--queue scroll-y">
      <header className="view__head">
        <h1 className="view__title">{t('navQueue')}</h1>
        {queue.length ? (
          <button type="button" className="view__link" onClick={clearQueue}>
            {t('clearQueue')}
          </button>
        ) : null}
      </header>

      {track ? (
        <section className="stack">
          <span className="label">{t('nowSection')}</span>
          <div className="row row--current">
            <Artwork url={track.artworkUrl} className="row__art row__art--md" alt={track.title} />
            <div className="row__meta">
              <span className="row__title">{track.title}</span>
              <span className="row__sub">{track.artist}</span>
            </div>
            {playing ? (
              <div className="eq" aria-hidden>
                <i />
                <i />
                <i />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="stack">
        <span className="label">
          {t('nextSection')} · {queue.length}
        </span>
        {queue.length === 0 ? (
          <div className="empty">
            <span className="empty__icon">☰</span>
            <span>{t('queueEmpty')}</span>
            <span className="empty__hint">{t('queueEmptyHint')}</span>
            <button type="button" className="btn btn--accent" onClick={openSearch}>
              {t('openSearch')}
            </button>
          </div>
        ) : (
          <div className="stack stack--tight">
            {queue.map((item) => (
              <div className="row" key={item.id}>
                <span className="row__grip" aria-hidden>
                  ⋮⋮
                </span>
                <Artwork
                  url={item.artworkUrl}
                  className="row__art"
                  onClick={() => void playTrack(item)}
                  ariaLabel={`${t('play')} ${item.title}`}
                />
                <button type="button" className="row__meta" onClick={() => void playTrack(item)}>
                  <span className="row__title">{item.title}</span>
                  <span className="row__sub">
                    {item.artist} · {formatTime(item.durationSec)}
                  </span>
                </button>
                <button
                  type="button"
                  className="row__remove"
                  onClick={() => dequeue(item.id)}
                  aria-label={t('remove')}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {related.length ? (
        <section className="stack">
          <div className="stack__head">
            <span className="label">{t('relatedSection')}</span>
            <button type="button" className="view__link" onClick={() => enqueueAll(related)}>
              {t('addAll')}
            </button>
          </div>
          <div className="stack stack--tight">
            {related.map((item) => (
              <div className="row row--ghost" key={item.id}>
                <Artwork
                  url={item.artworkUrl}
                  className="row__art"
                  onClick={() => void playTrack(item)}
                  ariaLabel={`${t('play')} ${item.title}`}
                />
                <button type="button" className="row__meta" onClick={() => void playTrack(item)}>
                  <span className="row__title">{item.title}</span>
                  <span className="row__sub">{item.artist}</span>
                </button>
                <button
                  type="button"
                  className="row__add"
                  onClick={() => enqueue(item)}
                  aria-label={t('addToQueue')}
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
