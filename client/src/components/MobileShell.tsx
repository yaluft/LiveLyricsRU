import { useEffect, useState } from 'react';
import type { Track } from '@lyrika/shared';
import { api } from '../api';
import { cycleRate, usePlayer } from '../state/player';
import { useT } from '../state/settings';
import { useUi } from '../state/ui';
import { formatRemaining, formatTime } from '../utils';
import { ArtistPanel } from './ArtistPanel';
import { Artwork } from './Artwork';
import { LangSwitch } from './LangSwitch';
import { PlaylistsView } from './PlaylistsView';
import { LyricStage } from './LyricStage';
import { Seekbar } from './Seekbar';
import { SettingsView } from './SettingsView';
import { VocabularyView } from './VocabularyView';
import { Icon } from './Icon';

type SheetTab = 'queue' | 'related' | 'playlists' | 'artist';

function QueueSheet(): JSX.Element {
  const t = useT();
  const [tab, setTab] = useState<SheetTab>('queue');
  const [related, setRelated] = useState<Track[]>([]);

  const track = usePlayer((s) => s.track);
  const queue = usePlayer((s) => s.queue);
  const playTrack = usePlayer((s) => s.playTrack);
  const enqueue = usePlayer((s) => s.enqueue);
  const setMobileSheet = useUi((s) => s.setMobileSheet);

  useEffect(() => {
    if (!track) return;
    let cancelled = false;
    api
      .search(track.artist)
      .then((response) => {
        if (!cancelled) setRelated(response.results.filter((r) => r.id !== track.id).slice(0, 5));
      })
      .catch(() => setRelated([]));
    return () => {
      cancelled = true;
    };
  }, [track]);

  return (
    <div className="sheet-scrim" onMouseDown={(event) => event.target === event.currentTarget && setMobileSheet(false)}>
      <div className="sheet">
        <button
          type="button"
          className="sheet__grab"
          onClick={() => setMobileSheet(false)}
          aria-label={t('close')}
        />

        <div className="sheet__tabs">
          {(
            [
              ['queue', t('navQueue')],
              ['related', t('relatedSection')],
              ['playlists', t('playlists')],
              ['artist', t('aboutArtist')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`sheet__tab${tab === id ? ' is-active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="sheet__body scroll-y">
          {tab === 'queue' ? (
            <div className="stack stack--tight">
              {track ? (
                <div className="row row--current">
                  <Artwork src={track.artworkUrl} className="row__art row__art--md" />
                  <div className="row__meta">
                    <span className="row__title">{track.title}</span>
                    <span className="row__sub">{track.artist} · играет</span>
                  </div>
                  <div className="eq" aria-hidden>
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              ) : null}
              {queue.length === 0 ? (
                <div className="empty">
                  <span className="empty__icon">☰</span>
                  <span>{t('queueEmpty')}</span>
                </div>
              ) : (
                queue.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="row row--tap"
                    onClick={() => void playTrack(item)}
                  >
                    <span className="row__grip" aria-hidden>
                      ⋮⋮
                    </span>
                    <Artwork src={item.artworkUrl} className="row__art row__art--md" />
                    <div className="row__meta">
                      <span className="row__title">{item.title}</span>
                      <span className="row__sub">
                        {item.artist} · {formatTime(item.durationSec)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : null}

          {tab === 'related' ? (
            <div className="stack stack--tight">
              {related.map((item) => (
                <div className="row" key={item.id}>
                  <Artwork
                    src={item.artworkUrl}
                    className="row__art row__art--md"
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
          ) : null}

          {tab === 'playlists' ? <PlaylistsView /> : null}

          {tab === 'artist' ? <ArtistPanel /> : null}
        </div>
      </div>
    </div>
  );
}

export function MobileShell(): JSX.Element {
  const t = useT();
  const track = usePlayer((s) => s.track);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const playing = usePlayer((s) => s.playing);
  const status = usePlayer((s) => s.status);
  const rate = usePlayer((s) => s.rate);
  const seek = usePlayer((s) => s.seek);
  const setRate = usePlayer((s) => s.setRate);
  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const previous = usePlayer((s) => s.previous);

  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const sheetOpen = useUi((s) => s.mobileSheetOpen);
  const setMobileSheet = useUi((s) => s.setMobileSheet);
  const openSearch = useUi((s) => s.openSearch);

  if (view === 'settings') {
    return (
      <div className="mobile mobile--panel">
        <header className="mobile__head">
          <button type="button" className="mobile__chev" onClick={() => setView('now')}>
            ⌄
          </button>
          <span className="mobile__title">{t('settingsTitle')}</span>
        </header>
        <SettingsView />
      </div>
    );
  }

  if (view === 'vocabulary') {
    return (
      <div className="mobile mobile--panel">
        <header className="mobile__head">
          <button type="button" className="mobile__chev" onClick={() => setView('now')}>
            ⌄
          </button>
          <span className="mobile__title">{t('vocabTitle')}</span>
        </header>
        <VocabularyView />
      </div>
    );
  }

  return (
    <div className="mobile">
      <header className="mobile__head">
        <button
          type="button"
          className="mobile__chev"
          onClick={openSearch}
          aria-label={t('openSearch')}
        >
          <Icon name="search" size={16} />
        </button>
        <div className="mobile__meta">
          <span className="mobile__title">{track?.title ?? t('appName')}</span>
          <span className="mobile__artist">{track?.artist ?? '—'}</span>
        </div>
        <LangSwitch compact />
        <button
          type="button"
          className="mobile__gear"
          onClick={() => setView('settings')}
          aria-label={t('navSettings')}
        >
          ⚙
        </button>
      </header>

      <main className="mobile__lyrics">
        <LyricStage variant="mobile" />
      </main>

      <footer className="mobile__dock">
        <div className="mobile__progress">
          <Seekbar position={position} duration={duration} onSeek={seek} thin />
          <div className="times">
            <span>{formatTime(position)}</span>
            <span>{formatRemaining(position, duration)}</span>
          </div>
        </div>

        <div className="mobile__controls">
          <button type="button" className="mobile__btn" onClick={() => setRate(cycleRate(rate))}>
            {rate.toFixed(2).replace(/0$/, '')}×
          </button>
          <button type="button" className="mobile__btn" onClick={previous} aria-label="Назад">
            <Icon name="prev" size={15} />
          </button>
          <button
            type="button"
            className="mobile__play"
            onClick={toggle}
            disabled={status === 'idle' || status === 'loading'}
            aria-label={playing ? t('pause') : t('play')}
          >
            {status === 'loading' ? (
              <span className="spinner spinner--dark" />
            ) : (
              <Icon name={playing ? 'pause' : 'play'} size={22} />
            )}
          </button>
          <button type="button" className="mobile__btn" onClick={next} aria-label="Вперёд">
            <Icon name="next" size={15} />
          </button>
          <button
            type="button"
            className="mobile__btn"
            onClick={() => setMobileSheet(true)}
            aria-label={t('navQueue')}
          >
            ☰
          </button>
        </div>
      </footer>

      {sheetOpen ? <QueueSheet /> : null}
    </div>
  );
}
