import { useState } from 'react';
import { usePlayer } from '../state/player';
import { useT } from '../state/settings';
import { useUi } from '../state/ui';
import { formatTime } from '../utils';
import { Artwork } from './Artwork';

export function ArtistPanel(): JSX.Element | null {
  const t = useT();
  const artist = usePlayer((s) => s.artist);
  const toggleArtist = useUi((s) => s.toggleArtist);
  const [showAllTracks, setShowAllTracks] = useState(false);

  if (!artist) return null;

  const tracks = showAllTracks ? artist.topTracks : artist.topTracks.slice(0, 5);
  const covers = artist.discography.slice(0, 7);
  const overflow = artist.discography.length - covers.length;

  return (
    <aside className="artist scroll-y">
      <div className="artist__head">
        <span className="label">{t('aboutArtist')}</span>
        <button type="button" className="artist__close" onClick={toggleArtist} aria-label={t('close')}>
          ✕
        </button>
      </div>

      <div className="artist__identity">
        <Artwork src={artist.photoUrl} alt={artist.name} className="artist__photo">
          <span className="mono">
            artist
            <br />
            photo
          </span>
        </Artwork>
        <div className="artist__meta">
          <span className="artist__name">{artist.name}</span>
          <span className="artist__line">
            {artist.origin} · {artist.activeYears}
          </span>
          <span className="artist__line">{artist.genres.join(' · ') || '—'}</span>
        </div>
      </div>

      {artist.topTracks.length ? (
        <section className="artist__section">
          <span className="label">{t('topSongs')}</span>
          <div className="artist__tracks">
            {tracks.map((entry, index) => (
              <div
                key={entry.title}
                className={`artist__track${index === 2 ? ' is-current' : ''}`}
              >
                <span className="mono artist__rank">{index + 1}</span>
                <span className="artist__tracktitle">{entry.title}</span>
                <span className="mono artist__tracktime">{formatTime(entry.durationSec)}</span>
              </div>
            ))}
            {artist.topTracks.length > 5 ? (
              <button
                type="button"
                className="artist__more"
                onClick={() => setShowAllTracks((open) => !open)}
              >
                {showAllTracks ? t('close') : t('showAllTen')}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="artist__section">
        <span className="label">{t('topCountries')}</span>
        <div className="artist__countries">
          {artist.topCountries.map((entry) => (
            <div key={entry.country} className="artist__country">
              <span className="artist__countryname">{entry.country}</span>
              <div className="artist__bar">
                <div
                  className="artist__barfill"
                  style={{ width: `${Math.round(entry.share * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {artist.estimated ? <span className="artist__note mono">{t('estimatedNote')}</span> : null}
      </section>

      {artist.discography.length ? (
        <section className="artist__section">
          <span className="label">
            {t('discography')} · {artist.discography.length} {t('albums')}
          </span>
          <div className="artist__grid">
            {covers.map((album) => (
              <Artwork
                key={album.title}
                src={album.coverUrl}
                alt={album.title}
                className="artist__cover"
                title={`${album.title} · ${album.year}`}
              />
            ))}
            {overflow > 0 ? <div className="artist__cover artist__cover--more">+{overflow}</div> : null}
          </div>
        </section>
      ) : null}
    </aside>
  );
}
