import { useEffect, useRef, useState } from 'react';
import type { Track } from '@lyrika/shared';
import { ApiFailure, api } from '../api';
import { usePlayer } from '../state/player';
import { useSettings, useT } from '../state/settings';
import { useUi } from '../state/ui';
import { formatTime } from '../utils';
import { Artwork } from './Artwork';
import { FavoriteButton } from './PlaylistsView';
import { Icon } from './Icon';

type Filter = 'all' | 'synced' | 'youtube';

const SUGGESTIONS = ['Сплин — Выхода нет', 'Кино — Группа крови', 'Земфира'];

export function SearchOverlay(): JSX.Element {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [sampled, setSampled] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<{ message: string; hint?: string } | null>(null);
  const [failures, setFailures] = useState<Record<string, { message: string; hint?: string }>>({});
  const [filter, setFilter] = useState<Filter>('all');

  const closeSearch = useUi((s) => s.closeSearch);
  const playTrack = usePlayer((s) => s.playTrack);
  const enqueue = usePlayer((s) => s.enqueue);
  const pendingTrackId = usePlayer((s) => s.pendingTrackId);
  const aiEnabled = useSettings((s) => s.aiEnabled);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSearch();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeSearch]);

  const runSearch = async (value: string) => {
    const term = value.trim();
    if (!term) return;
    setSearching(true);
    setSearchError(null);
    setFailures({});
    try {
      const response = await api.search(term);
      setResults(response.results);
      setSampled(response.sampled);
    } catch (error) {
      const failure = error instanceof ApiFailure ? error : null;
      setResults([]);
      setSearchError({
        message: failure?.message ?? 'Поиск не удался',
        ...(failure?.hint ? { hint: failure.hint } : {}),
      });
    } finally {
      setSearching(false);
    }
  };

  const start = async (track: Track) => {
    setFailures((current) => {
      const next = { ...current };
      delete next[track.id];
      return next;
    });
    try {
      await playTrack(track);
      if (usePlayer.getState().status === 'ready') closeSearch();
      else throw new Error(usePlayer.getState().error ?? 'Не удалось получить поток');
    } catch (error) {
      const message =
        usePlayer.getState().error ?? (error instanceof Error ? error.message : 'Ошибка');
      setFailures((current) => ({
        ...current,
        [track.id]: { message, hint: 'Попробовать вариант с YouTube' },
      }));
    }
  };

  const visible = results.filter((track) => {
    if (filter === 'synced') return track.hasSyncedLyrics;
    if (filter === 'youtube') return track.provider === 'youtube';
    return true;
  });

  return (
    <div className="modal-scrim" onMouseDown={(event) => event.target === event.currentTarget && closeSearch()}>
      <div className="modal modal--search">
        <div className="modal__body">
          <form
            className="searchbar"
            onSubmit={(event) => {
              event.preventDefault();
              void runSearch(query);
            }}
          >
            <div className="field">
              <Icon name="search" size={15} />
              <input
                ref={inputRef}
                value={query}
                placeholder={t('searchLanding')}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={t('searchPlaceholder')}
              />
            </div>
            <button type="submit" className="btn btn--primary" disabled={searching}>
              {searching ? '…' : t('searchAction')}
            </button>
            <button type="button" className="btn" onClick={closeSearch}>
              {t('close')}
            </button>
          </form>

          {results.length ? (
            <div className="searchfilters">
              <button
                type="button"
                className={`chip${filter === 'all' ? ' is-active' : ''}`}
                onClick={() => setFilter('all')}
              >
                {t('filterAll')}
              </button>
              <button
                type="button"
                className={`chip${filter === 'synced' ? ' is-active' : ''}`}
                onClick={() => setFilter('synced')}
              >
                {t('filterSynced')}
              </button>
              <button
                type="button"
                className={`chip${filter === 'youtube' ? ' is-active' : ''}`}
                onClick={() => setFilter('youtube')}
              >
                {t('filterYoutube')}
              </button>
              <span className="mono searchfilters__count">
                {visible.length} {t('searchResults')}
                {sampled ? ` · ${t('sampleBadge')}` : ''}
              </span>
            </div>
          ) : null}

          {!results.length && !searching ? (
            <div className="suggestions">
              <span className="suggestions__label">{t('tryThese')}</span>
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setQuery(suggestion);
                    void runSearch(suggestion);
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          {searchError ? (
            <div className="errorrow">
              <div className="errorrow__body">
                <span className="errorrow__title">{searchError.message}</span>
                {searchError.hint ? (
                  <span className="errorrow__hint">{searchError.hint}</span>
                ) : null}
              </div>
              <button type="button" className="btn btn--danger" onClick={() => void runSearch(query)}>
                {t('retry')}
              </button>
            </div>
          ) : null}

          <div className="stack stack--tight">
            {visible.map((track) => {
              const failure = failures[track.id];
              if (failure) {
                return (
                  <div className="errorrow errorrow--track" key={track.id}>
                    <div className="errorrow__row">
                      <div className="errorrow__thumb" />
                      <div className="errorrow__body">
                        <span className="errorrow__title">{track.title}</span>
                        <span className="errorrow__hint">{failure.message}</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => void start(track)}
                      >
                        {t('retry')}
                      </button>
                    </div>
                    <button type="button" className="errorrow__alt" onClick={() => void start(track)}>
                      {t('tryYoutube')}
                    </button>
                  </div>
                );
              }

              const pending = pendingTrackId === track.id;
              return (
                <div className={`resultrow${pending ? ' is-pending' : ''}`} key={track.id}>
                  <Artwork
                    src={track.artworkUrl}
                    className="resultrow__thumb"
                    onClick={() => void start(track)}
                    ariaLabel={`${t('play')} ${track.title}`}
                  />
                  <button type="button" className="resultrow__meta" onClick={() => void start(track)}>
                    <span className="resultrow__title">{track.title}</span>
                    <span className="resultrow__sub">
                      <span>{track.artist}</span>
                      <span
                        className={`mono resultrow__badge${
                          track.hasSyncedLyrics ? ' resultrow__badge--synced' : ''
                        }`}
                      >
                        {track.hasSyncedLyrics ? t('syncedBadge') : t('textOnlyBadge')}
                      </span>
                    </span>
                  </button>

                  {pending ? (
                    <div className="resultrow__pending">
                      <div className="spinner" />
                      <span>{t('loadingStream')}</span>
                    </div>
                  ) : (
                    <>
                      <span className="mono resultrow__time">{formatTime(track.durationSec)}</span>
                      <FavoriteButton track={track} />
                      <button type="button" className="btn" onClick={() => enqueue(track)}>
                        {t('addToQueue')}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {aiEnabled ? (
            <div className="aibanner">
              <span className="aibanner__icon">✦</span>
              <span className="aibanner__text">{t('noLyricsPrompt')}</span>
              <button
                type="button"
                className="btn btn--accent"
                disabled={!query.trim()}
                onClick={() => {
                  void api
                    .aiLyrics({ query: query.trim() })
                    .then((response) => {
                      usePlayer.getState().applyLyrics(response.lyrics);
                      useUi.getState().toast(response.notice, 'info');
                      closeSearch();
                    })
                    .catch(() => useUi.getState().toast('Ассистент недоступен', 'error'));
                }}
              >
                {t('create')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
