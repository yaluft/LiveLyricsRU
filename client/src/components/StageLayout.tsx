import { useCallback, useState } from 'react';
import { CLIP_WINDOW_SEC } from '@lyrika/shared';
import { cycleRate, usePlayer } from '../state/player';
import { useSettings, useT } from '../state/settings';
import { useUi } from '../state/ui';
import { formatRemaining, formatTime } from '../utils';
import { useEscape } from '../useEscape';
import { ClipsView } from './ClipsView';
import { DisplayMenu } from './DisplayMenu';
import { LangSwitch } from './LangSwitch';
import { LyricStage } from './LyricStage';
import { QueueView } from './QueueView';
import { Seekbar } from './Seekbar';
import { Slider } from './Slider';
import { SessionView } from './SessionView';
import { SettingsView } from './SettingsView';
import { TransportControls } from './TransportControls';
import { VocabularyView } from './VocabularyView';
import { Icon } from './Icon';
import { Thumb } from './Thumb';

/** In Stage mode the secondary views float over the lyrics instead of docking. */
function StageOverlay(): JSX.Element | null {
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const t = useT();
  const close = useCallback(() => setView('now'), [setView]);
  useEscape(close);

  if (view === 'now') return null;

  const body =
    view === 'queue' ? (
      <QueueView />
    ) : view === 'vocabulary' ? (
      <VocabularyView />
    ) : view === 'clips' ? (
      <ClipsView />
    ) : view === 'session' ? (
      <SessionView />
    ) : (
      <SettingsView />
    );

  return (
    <div
      className="modal-scrim"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div className="modal modal--overlay">
        <button
          type="button"
          className="modal__close"
          onClick={close}
          aria-label={t('close')}
        >
          ✕
        </button>
        {body}
      </div>
    </div>
  );
}

export function StageLayout(): JSX.Element {
  const t = useT();
  const [displayOpen, setDisplayOpen] = useState(false);

  const track = usePlayer((s) => s.track);
  const stream = usePlayer((s) => s.stream);
  const lyrics = usePlayer((s) => s.lyrics);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const rate = usePlayer((s) => s.rate);
  const volume = usePlayer((s) => s.volume);
  const ab = usePlayer((s) => s.ab);
  const queueLength = usePlayer((s) => s.queue.length);
  const seek = usePlayer((s) => s.seek);
  const setRate = usePlayer((s) => s.setRate);
  const setVolume = usePlayer((s) => s.setVolume);
  const markAb = usePlayer((s) => s.markAb);

  const openSearch = useUi((s) => s.openSearch);
  const setView = useUi((s) => s.setView);
  const setClipComposer = useUi((s) => s.setClipComposer);
  const layout = useSettings((s) => s.layout);
  const setSetting = useSettings((s) => s.set);

  const providerLabel =
    stream?.provider === 'demo' || !stream?.url
      ? `▶ ${t('demoMode')}`
      : `▶ ${stream.provider} · ${stream.bitrateKbps} kbps`;

  return (
    <div className="stage">
      <header className="stage__chrome">
        <div className="stage__now">
          <Thumb src={track?.artworkUrl} className="stage__art" />
          <div className="stage__nowtext">
            <span className="stage__title">{track?.title ?? t('appName')}</span>
            <span className="stage__sub">
              {track ? `${track.artist} · ${lyrics?.sourceLabel ?? '—'}` : t('landingBlurb')}
            </span>
          </div>
        </div>

        <div className="stage__tools">
          <div className="stage__toolpill">
            <button
              type="button"
              className="icon-btn"
              onClick={openSearch}
              aria-label={t('openSearch')}
            >
              <Icon name="search" size={15} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setView('queue')}
              aria-label={t('navQueue')}
            >
              ☰
            </button>
            <div className="stage__displaywrap">
              <button
                type="button"
                className={`icon-btn${displayOpen ? ' is-active' : ''}`}
                onClick={() => setDisplayOpen((open) => !open)}
                aria-label={t('displaySection')}
              >
                Аа
              </button>
              {displayOpen ? <DisplayMenu onClose={() => setDisplayOpen(false)} /> : null}
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setView('settings')}
              aria-label={t('navSettings')}
            >
              ⚙
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSetting('layout', layout === 'stage' ? 'studio' : 'stage')}
              aria-label={t('layoutStudio')}
              title={t('layoutStudio')}
            >
              ▦
            </button>
          </div>
          <LangSwitch />
        </div>
      </header>

      <main className="stage__main">
        <LyricStage variant="stage" />
      </main>

      <StageOverlay />

      <footer className="stage__dock">
        <div className="dock">
          <TransportControls size="lg" />

          <div className="dock__progress">
            <Seekbar position={position} duration={duration} onSeek={seek} markers={ab} />
            <div className="times">
              <span>{formatTime(position)}</span>
              <span>{formatRemaining(position, duration)}</span>
            </div>
          </div>

          <div className="dock__tools">
            <button type="button" className="btn" onClick={() => setRate(cycleRate(rate))}>
              {rate.toFixed(2).replace(/0$/, '')}×
            </button>
            <button
              type="button"
              className={`btn${ab ? ' is-active' : ''}`}
              onClick={markAb}
              title={ab?.b === null ? 'Отметьте точку B' : undefined}
            >
              {t('abRepeat')}
              {ab?.b === null ? ' · A' : ''}
            </button>
            <button
              type="button"
              className="btn btn--accent"
              onClick={() => setClipComposer(true)}
              disabled={!track}
            >
              ✂ {CLIP_WINDOW_SEC}с
            </button>
            <div className="dock__divider" />
            <span className="dock__volicon"><Icon name="volume" size={15} /></span>
            <Slider
              className="dock__volume"
              value={volume}
              min={0}
              max={1}
              step={0.01}
              label="Громкость"
              onChange={setVolume}
            />
          </div>
        </div>

        <div className="dock__status mono">
          <span>{providerLabel}</span>
          <span>·</span>
          <span>lyrics: {lyrics ? lyrics.sourceLabel : '—'}</span>
          <span>·</span>
          <span>
            {t('navQueue').toLowerCase()}: {queueLength}
          </span>
        </div>
      </footer>
    </div>
  );
}
