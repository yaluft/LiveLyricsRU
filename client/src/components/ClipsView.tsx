import { useEffect } from 'react';
import { WAVE_THEMES } from '@lyrika/shared';
import { useLibrary } from '../state/library';
import { usePlayer } from '../state/player';
import { useSettings, useT } from '../state/settings';
import { useUi } from '../state/ui';
import { formatTime } from '../utils';

export function ClipsView(): JSX.Element {
  const t = useT();
  const feed = useLibrary((s) => s.feed);
  const load = useLibrary((s) => s.load);
  const loaded = useLibrary((s) => s.loaded);
  const recents = usePlayer((s) => s.recents);
  const playTrack = usePlayer((s) => s.playTrack);
  const seek = usePlayer((s) => s.seek);
  const track = usePlayer((s) => s.track);
  const setClipComposer = useUi((s) => s.setClipComposer);
  const preset = useSettings((s) => s.wavePreset);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const theme = WAVE_THEMES[preset];

  return (
    <section className="view scroll-y">
      <header className="view__head view__head--split">
        <div className="view__headtext">
          <h1 className="view__title">{t('navClips')}</h1>
          <span className="view__sub">{t('clipFeed')}</span>
        </div>
        <button
          type="button"
          className="btn btn--accent"
          disabled={!track}
          onClick={() => setClipComposer(true)}
        >
          {t('clip')}
        </button>
      </header>

      <div className="stack stack--tight">
        {feed.map((clip) => (
          <article className="clipcard" key={clip.id}>
            <div
              className="clipcard__thumb"
              style={{ background: `linear-gradient(180deg, ${theme.fog}, ${theme.surface})` }}
            />
            <div className="clipcard__meta">
              <span className="clipcard__line">«{clip.lineText}»</span>
              <span className="clipcard__sub">
                {clip.trackTitle} — {clip.artist}
              </span>
              <span className="clipcard__author mono">
                {clip.author} · {formatTime(clip.endSec - clip.startSec)} · {clip.likes} ♥
              </span>
            </div>
            <button
              type="button"
              className="view__link"
              onClick={() => {
                const known = recents.find((r) => r.id === clip.trackId);
                if (track?.id === clip.trackId) seek(clip.startSec);
                else if (known) void playTrack(known);
              }}
            >
              {t('clipListen')}
            </button>
          </article>
        ))}
      </div>

      <span className="view__footnote mono">{t('simulatedBadge')} — {t('sessionSimulated')}</span>
    </section>
  );
}
