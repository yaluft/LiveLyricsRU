import { useCallback, useMemo, useState } from 'react';
import { CLIP_WINDOW_SEC, WAVE_THEMES } from '@lyrika/shared';
import { useLibrary } from '../state/library';
import { usePlayer } from '../state/player';
import { useSettings, useT } from '../state/settings';
import { useUi } from '../state/ui';
import { clamp, formatTime } from '../utils';
import { useEscape } from '../useEscape';

const BARS = [14, 26, 20, 34, 22, 30, 16, 28, 38, 24, 18, 30];

export function ClipComposer(): JSX.Element | null {
  const t = useT();
  const track = usePlayer((s) => s.track);
  const lyrics = usePlayer((s) => s.lyrics);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const seek = usePlayer((s) => s.seek);

  const setClipComposer = useUi((s) => s.setClipComposer);
  const toast = useUi((s) => s.toast);
  const publishClip = useLibrary((s) => s.publishClip);
  const feed = useLibrary((s) => s.feed);
  const preset = useSettings((s) => s.wavePreset);

  const line = useMemo(
    () => lyrics?.lines.find((l) => position >= l.time && position < l.end) ?? lyrics?.lines[0],
    [lyrics, position],
  );

  const [start, setStart] = useState(() =>
    clamp(line ? line.time : position, 0, Math.max(0, duration - CLIP_WINDOW_SEC)),
  );
  const [show, setShow] = useState({
    translit: true,
    translation: true,
    waves: false,
    artwork: false,
  });
  const [publishing, setPublishing] = useState(false);
  const close = useCallback(() => setClipComposer(false), [setClipComposer]);
  useEscape(close);

  if (!track) return null;

  const end = start + CLIP_WINDOW_SEC;
  const theme = WAVE_THEMES[preset];
  const windowStart = Math.max(0, start - 8);
  const windowEnd = Math.min(duration || end + 12, end + 12);
  const span = Math.max(windowEnd - windowStart, 1);
  const selectionLeft = ((start - windowStart) / span) * 100;
  const selectionWidth = (CLIP_WINDOW_SEC / span) * 100;

  return (
    <div className="modal-scrim" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="modal modal--clip">
        <div className="modal__head">
          <span className="modal__title">{t('clipTitle')}</span>
          <span className="mono modal__meta">
            {formatTime(start)} → {formatTime(end)} · {track.title}
          </span>
        </div>

        <div className="modal__body clipbody">
          <div
            className="clippreview"
            style={{ background: `linear-gradient(180deg, ${theme.fog}, ${theme.surface})` }}
          >
            <div className="clippreview__content">
              {show.translit && line ? (
                <span className="mono clippreview__translit">{line.translit}</span>
              ) : null}
              <span className="clippreview__line">{line?.text ?? track.title}</span>
              {show.translation && line ? (
                <span className="clippreview__translation">
                  {line.translation || t('noTranslation')}
                </span>
              ) : null}
            </div>
            <div className="clippreview__foot mono">
              <span>{track.artist}</span>
              <span>лирика.app</span>
            </div>
          </div>

          <div className="clipcontrols">
            <section className="stack stack--tight">
              <span className="label">{t('clipWindow')}</span>
              <button
                type="button"
                className="clipscrub"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
                  const next = windowStart + ratio * span - CLIP_WINDOW_SEC / 2;
                  setStart(clamp(next, 0, Math.max(0, duration - CLIP_WINDOW_SEC)));
                }}
                aria-label={t('clipWindow')}
              >
                <div className="clipscrub__bars">
                  {BARS.map((height, index) => (
                    <div key={index} className="clipscrub__bar" style={{ height }} />
                  ))}
                </div>
                <div
                  className="clipscrub__selection"
                  style={{ left: `${selectionLeft}%`, width: `${selectionWidth}%` }}
                />
              </button>
              <div className="times">
                <span>{formatTime(windowStart)}</span>
                <span>
                  {formatTime(start)} — {formatTime(end)}
                </span>
                <span>{formatTime(windowEnd)}</span>
              </div>
            </section>

            <section className="stack stack--tight">
              <span className="label">{t('clipShow')}</span>
              <div className="chiprow">
                {(
                  [
                    ['translit', t('aiTranslit')],
                    ['translation', t('aiTranslation')],
                    ['waves', t('clipWaves')],
                    ['artwork', t('clipArtwork')],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`chip${show[key] ? ' is-active' : ''}`}
                    onClick={() => setShow((current) => ({ ...current, [key]: !current[key] }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <div className="clipactions">
              <button
                type="button"
                className="btn btn--primary clipactions__publish"
                disabled={publishing || !line}
                onClick={async () => {
                  if (!line) {
                    toast(t('clipNoLine'), 'error');
                    return;
                  }
                  setPublishing(true);
                  await publishClip({
                    trackId: track.id,
                    trackTitle: track.title,
                    artist: track.artist,
                    startSec: start,
                    endSec: end,
                    lineText: line.text,
                    translit: line.translit,
                    translation: line.translation,
                    show,
                  });
                  setPublishing(false);
                  close();
                }}
              >
                {publishing ? '…' : t('clipPublish')}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => toast('Экспорт MP4 ещё не подключён', 'info')}
              >
                {t('clipDownload')}
              </button>
              <button type="button" className="btn" onClick={() => seek(start)}>
                ▶
              </button>
            </div>

            <section className="stack stack--tight">
              <span className="label">{t('clipFeed')}</span>
              <div className="stack stack--tight">
                {feed.slice(0, 2).map((clip) => (
                  <div className="row row--ghost" key={clip.id}>
                    <div
                      className="clipcard__thumb"
                      style={{
                        background: `linear-gradient(180deg, ${theme.fog}, ${theme.surface})`,
                      }}
                    />
                    <div className="row__meta">
                      <span className="row__title">
                        «{clip.trackTitle}» — {clip.artist}
                      </span>
                      <span className="row__sub">
                        {clip.author} · {Math.round(clip.endSec - clip.startSec)}s · {clip.likes} ♥
                      </span>
                    </div>
                    <span className="view__link">{t('clipListen')}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
