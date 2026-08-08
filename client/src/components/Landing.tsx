import { useEffect, useState } from 'react';
import type { Track } from '@lyrika/shared';
import { api } from '../api';
import { usePlayer } from '../state/player';
import { useT } from '../state/settings';
import { formatTime } from '../utils';
import { LangSwitch } from './LangSwitch';
import { Icon } from './Icon';
import { Artwork } from './Artwork';

const SUGGESTIONS = ['Сплин — Выхода нет', 'Кино — Группа крови', 'Земфира'];

export function Landing(): JSX.Element {
  const t = useT();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [starters, setStarters] = useState<Track[]>([]);

  const playTrack = usePlayer((s) => s.playTrack);
  const playUrl = usePlayer((s) => s.playUrl);
  const recents = usePlayer((s) => s.recents);

  useEffect(() => {
    api
      .search('Земфира')
      .then((response) => setStarters(response.results.slice(0, 3)))
      .catch(() => setStarters([]));
  }, []);

  const submit = async (value: string) => {
    const term = value.trim();
    if (!term) return;
    setBusy(true);
    if (/^https?:\/\//i.test(term)) {
      await playUrl(term);
    } else {
      const response = await api.search(term).catch(() => null);
      const first = response?.results[0];
      if (first) await playTrack(first);
    }
    setBusy(false);
  };

  const continueRow = recents.length ? recents.slice(0, 3) : starters;

  return (
    <div className="landing">
      <div className="landing__lang">
        <LangSwitch />
      </div>

      <div className="landing__inner">
        <div className="landing__hero">
          <h1 className="landing__logo">{t('appName')}</h1>
          <p className="landing__blurb">{t('landingBlurb')}</p>
        </div>

        <form
          className="landing__form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(query);
          }}
        >
          <div className="landing__row">
            <div className="field landing__field">
              <Icon name="search" size={15} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('searchLanding')}
                aria-label={t('searchPlaceholder')}
              />
            </div>
            <button type="submit" className="btn btn--primary landing__submit" disabled={busy}>
              {busy ? '…' : t('searchAction')}
            </button>
          </div>

          <div className="landing__suggestions">
            <span className="landing__try">{t('tryThese')}</span>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="chip"
                onClick={() => {
                  setQuery(suggestion);
                  void submit(suggestion);
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </form>

        {continueRow.length ? (
          <div className="landing__continue">
            <span className="label">{t('continueListening')}</span>
            <div className="landing__cards">
              {continueRow.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="landing__card"
                  onClick={() => void playTrack(item)}
                >
                  <Artwork url={item.artworkUrl} className="landing__cardart" alt={item.title} />
                  <div className="landing__cardmeta">
                    <span className="landing__cardtitle">{item.title}</span>
                    <span className="landing__cardsub">{formatTime(item.durationSec)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
