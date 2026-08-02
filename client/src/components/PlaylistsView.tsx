import { useState } from 'react';
import type { ImportSource, Playlist, Track } from '@lyrika/shared';
import { usePlayer } from '../state/player';
import { usePlaylists, useIsFavorite } from '../state/playlists';
import { useT } from '../state/settings';
import { useUi } from '../state/ui';
import { formatTime } from '../utils';
import { Artwork } from './Artwork';

const SOURCES: { id: ImportSource; key: 'importDeezer' | 'importYoutube' | 'importSpotify' | 'importText' }[] = [
  { id: 'deezer', key: 'importDeezer' },
  { id: 'youtube', key: 'importYoutube' },
  { id: 'spotify', key: 'importSpotify' },
  { id: 'text', key: 'importText' },
];

/** Heart toggle used by search results and both now-playing docks. */
export function FavoriteButton({
  track,
  className,
}: {
  track: Track;
  className?: string;
}): JSX.Element {
  const t = useT();
  const active = useIsFavorite(track.id);
  const toggleFavorite = usePlaylists((s) => s.toggleFavorite);
  const label = active ? t('removeFromFavorites') : t('addToFavorites');

  return (
    <button
      type="button"
      className={`heart${className ? ` ${className}` : ''}${active ? ' is-active' : ''}`}
      onClick={() => void toggleFavorite(track)}
      aria-label={label}
      title={label}
      aria-pressed={active}
    >
      {active ? '♥' : '♡'}
    </button>
  );
}

function ImportPanel(): JSX.Element {
  const t = useT();
  const importing = usePlaylists((s) => s.importing);
  const runImport = usePlaylists((s) => s.runImport);

  const [source, setSource] = useState<ImportSource>('deezer');
  const [url, setUrl] = useState('');
  const [body, setBody] = useState('');

  const ready = source === 'text' ? body.trim().length > 0 : url.trim().length > 0;

  const submit = async () => {
    const payload =
      source === 'text'
        ? { source, body: body.trim() }
        : { source, url: url.trim() };

    const response = await runImport(payload);
    if (!response) return;

    const parts = [`${t('importDone')}: ${response.imported}`];
    // Never swallow entries the server could not match — report the shortfall.
    if (response.skipped.length) parts.push(`${response.skipped.length} ${t('importSkipped')}`);
    useUi.getState().toast(parts.join(' · '), response.skipped.length ? 'info' : 'success');

    if (source === 'text') setBody('');
    else setUrl('');
  };

  return (
    <section className="stack playlists__import">
      <span className="label">{t('importSection')}</span>

      <div className="chiprow">
        {SOURCES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`chip${source === entry.id ? ' is-active' : ''}`}
            onClick={() => setSource(entry.id)}
          >
            {t(entry.key)}
          </button>
        ))}
      </div>

      {source === 'text' ? (
        <textarea
          className="playlists__textarea"
          value={body}
          rows={5}
          placeholder={t('importTextPlaceholder')}
          aria-label={t('importTextPlaceholder')}
          onChange={(event) => setBody(event.target.value)}
        />
      ) : (
        <div className="field">
          <input
            value={url}
            placeholder={t('importUrlPlaceholder')}
            aria-label={t('importUrlPlaceholder')}
            onChange={(event) => setUrl(event.target.value)}
          />
        </div>
      )}

      <button
        type="button"
        className={`btn btn--accent playlists__importbtn${importing ? ' is-pending' : ''}`}
        disabled={!ready || importing}
        onClick={() => void submit()}
      >
        {importing ? t('importPending') : t('importRun')}
      </button>
    </section>
  );
}

function PlaylistCard({ playlist }: { playlist: Playlist }): JSX.Element {
  const t = useT();
  const [open, setOpen] = useState(playlist.favorite);
  const removePlaylist = usePlaylists((s) => s.remove);
  const removeTrack = usePlaylists((s) => s.removeTrack);

  const playAll = () => {
    const [first, ...rest] = playlist.tracks;
    if (!first) return;
    const { playTrack, enqueueAll } = usePlayer.getState();
    void playTrack(first);
    if (rest.length) enqueueAll(rest);
  };

  return (
    <section className={`playlist${playlist.favorite ? ' playlist--favorite' : ''}`}>
      <header className="playlist__head">
        <button
          type="button"
          className="playlist__toggle"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <span className="playlist__chev" aria-hidden>
            {open ? '⌄' : '›'}
          </span>
          <span className="playlist__name">
            {playlist.favorite ? `♥ ${t('favorites')}` : playlist.name}
          </span>
          <span className="mono playlist__count">
            {playlist.tracks.length} {t('trackCount')}
          </span>
        </button>

        <div className="playlist__actions">
          <button
            type="button"
            className="btn"
            disabled={playlist.tracks.length === 0}
            onClick={playAll}
          >
            {t('playAllTracks')}
          </button>
          {playlist.favorite ? null : (
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => void removePlaylist(playlist.id)}
              aria-label={t('deletePlaylist')}
              title={t('deletePlaylist')}
            >
              ✕
            </button>
          )}
        </div>
      </header>

      {open ? (
        playlist.tracks.length === 0 ? (
          <span className="playlist__empty">{t('emptyPlaylist')}</span>
        ) : (
          <div className="stack stack--tight">
            {playlist.tracks.map((item) => (
              <div className="row" key={item.id}>
                <Artwork
                  src={item.artworkUrl}
                  className="row__art"
                  onClick={() => void usePlayer.getState().playTrack(item)}
                  ariaLabel={`${t('play')} ${item.title}`}
                />
                <button
                  type="button"
                  className="row__meta"
                  onClick={() => void usePlayer.getState().playTrack(item)}
                >
                  <span className="row__title">{item.title}</span>
                  <span className="row__sub">
                    {item.artist} · {formatTime(item.durationSec)}
                  </span>
                </button>
                <button
                  type="button"
                  className="row__remove"
                  onClick={() => void removeTrack(playlist.id, item.id)}
                  aria-label={t('removeFromPlaylist')}
                  title={t('removeFromPlaylist')}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}

export function PlaylistsView(): JSX.Element {
  const t = useT();
  const playlists = usePlaylists((s) => s.playlists);
  const create = usePlaylists((s) => s.create);
  const [name, setName] = useState('');

  // Favourites is pinned to the top; everything else keeps server order.
  const ordered = [...playlists].sort((a, b) => Number(b.favorite) - Number(a.favorite));

  return (
    <section className="view view--playlists scroll-y">
      <header className="view__head">
        <h1 className="view__title">{t('playlists')}</h1>
      </header>

      <form
        className="playlists__new"
        onSubmit={(event) => {
          event.preventDefault();
          void create(name);
          setName('');
        }}
      >
        <div className="field playlists__field">
          <input
            value={name}
            placeholder={t('playlistName')}
            aria-label={t('newPlaylist')}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
          {t('createPlaylist')}
        </button>
      </form>

      {ordered.length === 0 ? (
        <div className="empty">
          <span className="empty__icon">♥</span>
          <span>{t('noPlaylists')}</span>
        </div>
      ) : (
        <div className="stack">
          {ordered.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </div>
      )}

      <ImportPanel />
    </section>
  );
}
