import { onMount, type JSX } from 'solid-js';
import { OceanBackground } from './OceanBackground';
import { LyricStage } from './LyricStage';
import { TransportControls } from './TransportControls';
import { Seekbar } from './Seekbar';
import { playerState, playDemoTrack, seek } from './store';

// A single hasSyncedLyrics:true demo entry from server/src/data/catalog.ts —
// search/landing is out of scope, so the spike starts here directly.
const DEMO_TRACK_ID = 'demo-nebo-v-glazakh';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Solid port of client/src/components/StageLayout.tsx, trimmed to what the
 * spike needs: now-playing chrome, the lyric stage, and a transport dock.
 * Queue/search/settings/A-B loop/rate/volume chrome is out of scope.
 */
export function Stage(): JSX.Element {
  onMount(() => {
    void playDemoTrack(DEMO_TRACK_ID);
  });

  return (
    <div class="app">
      <OceanBackground />

      <div class="app__content">
        <div class="stage">
          <header class="stage__chrome">
            <div class="stage__now">
              <div class="art stage__art" />
              <div class="stage__nowtext">
                <span class="stage__title">{playerState.track?.title ?? 'Lyrika'}</span>
                <span class="stage__sub">
                  {playerState.track
                    ? `${playerState.track.artist} · ${playerState.lyrics?.sourceLabel ?? '—'}`
                    : 'Solid Stage spike'}
                </span>
              </div>
            </div>
          </header>

          <main class="stage__main">
            <LyricStage />
          </main>

          <footer class="stage__dock">
            <div class="dock">
              <TransportControls size="lg" />

              <div class="dock__progress">
                <Seekbar position={playerState.position} duration={playerState.duration} onSeek={seek} />
                <div class="times">
                  <span>{formatTime(playerState.position)}</span>
                  <span>-{formatTime(Math.max(0, playerState.duration - playerState.position))}</span>
                </div>
              </div>
            </div>

            <div class="dock__status mono">
              <span>status: {playerState.status}</span>
              <span>·</span>
              <span>lyrics: {playerState.lyrics ? playerState.lyrics.sourceLabel : playerState.lyricsStatus}</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
