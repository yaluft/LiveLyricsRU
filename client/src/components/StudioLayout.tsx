import { CLIP_WINDOW_SEC } from '@lyrika/shared';
import { cycleRate, usePlayer } from '../state/player';
import { useLibrary } from '../state/library';
import { useT } from '../state/settings';
import { useUi } from '../state/ui';
import { formatTime } from '../utils';
import { ArtistPanel } from './ArtistPanel';
import { LyricStage } from './LyricStage';
import { QueueView } from './QueueView';
import { Seekbar } from './Seekbar';
import { SettingsView } from './SettingsView';
import { Sidebar } from './Sidebar';
import { SessionView } from './SessionView';
import { ClipsView } from './ClipsView';
import { TransportControls } from './TransportControls';
import { VocabularyView } from './VocabularyView';

function CentrePane(): JSX.Element {
  const view = useUi((s) => s.view);
  switch (view) {
    case 'queue':
      return <QueueView />;
    case 'vocabulary':
      return <VocabularyView />;
    case 'clips':
      return <ClipsView />;
    case 'session':
      return <SessionView />;
    case 'settings':
      return <SettingsView />;
    case 'now':
      return <LyricStage variant="studio" />;
    default:
      return <LyricStage variant="studio" />;
  }
}

export function StudioLayout(): JSX.Element {
  const t = useT();
  const track = usePlayer((s) => s.track);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const rate = usePlayer((s) => s.rate);
  const ab = usePlayer((s) => s.ab);
  const seek = usePlayer((s) => s.seek);
  const setRate = usePlayer((s) => s.setRate);
  const markAb = usePlayer((s) => s.markAb);

  const artistOpen = useUi((s) => s.artistOpen);
  const toggleArtist = useUi((s) => s.toggleArtist);
  const setClipComposer = useUi((s) => s.setClipComposer);
  const view = useUi((s) => s.view);

  const saveLine = useLibrary((s) => s.saveLine);
  const lyrics = usePlayer((s) => s.lyrics);
  const savedLines = useLibrary((s) => s.lines);

  const currentLine = lyrics?.lines.find((l) => position >= l.time && position < l.end);
  const lineSaved = currentLine
    ? savedLines.some((l) => l.text === currentLine.text && l.trackId === track?.id)
    : false;

  return (
    <div className="studio">
      <div className="studio__body">
        <Sidebar />

        <div className={`studio__centre${view === 'now' ? ' studio__centre--stage' : ''}`}>
          <CentrePane />
        </div>

        {artistOpen ? (
          <ArtistPanel />
        ) : (
          <button type="button" className="studio__artistopen" onClick={toggleArtist}>
            {t('aboutArtist')}
          </button>
        )}
      </div>

      <footer className="studiodock">
        <div className="studiodock__now">
          <div className="art studiodock__art" />
          <div className="studiodock__meta">
            <span className="studiodock__title">{track?.title ?? t('nothingPlaying')}</span>
            <span className="studiodock__artist">{track?.artist ?? '—'}</span>
          </div>
          <button
            type="button"
            className={`studiodock__star${lineSaved ? ' is-on' : ''}`}
            disabled={!currentLine || !track}
            aria-label={t('saveWord')}
            onClick={() => {
              if (!currentLine || !track) return;
              void saveLine({
                text: currentLine.text,
                translation: currentLine.translation,
                trackId: track.id,
                trackTitle: track.title,
                startSec: currentLine.time,
                endSec: currentLine.end,
              });
            }}
          >
            ★
          </button>
        </div>

        <TransportControls size="md" />

        <div className="studiodock__progress">
          <span className="mono studiodock__time">{formatTime(position)}</span>
          <Seekbar position={position} duration={duration} onSeek={seek} thin markers={ab} />
          <span className="mono studiodock__time">{formatTime(duration)}</span>
        </div>

        <div className="studiodock__tools">
          <button type="button" className="btn" onClick={() => setRate(cycleRate(rate))}>
            {rate.toFixed(2).replace(/0$/, '')}×
          </button>
          <button type="button" className={`btn${ab ? ' is-active' : ''}`} onClick={markAb}>
            {t('abRepeat')}
            {ab?.b === null ? ' · A' : ''}
          </button>
          <button
            type="button"
            className="btn btn--accent"
            disabled={!track}
            onClick={() => setClipComposer(true)}
          >
            ✂ {CLIP_WINDOW_SEC}с
          </button>
        </div>
      </footer>
    </div>
  );
}
