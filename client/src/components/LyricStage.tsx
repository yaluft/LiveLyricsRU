import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { CLIP_WINDOW_SEC } from '@lyrika/shared';
import { activeLineIndex, activeWordIndex, cycleRate, usePlayer } from '../state/player';
import { useLibrary } from '../state/library';
import { useSettings, useT } from '../state/settings';
import { useUi } from '../state/ui';
import { WordPopover } from './WordPopover';

export type StageVariant = 'stage' | 'studio' | 'mobile';

interface Props {
  variant: StageVariant;
}

const VISIBLE_RADIUS = 2;

function fadeFor(distance: number): number {
  if (distance === 1) return 0.52;
  if (distance === 2) return 0.3;
  return 0.2;
}

export function LyricStage({ variant }: Props): JSX.Element {
  const lyrics = usePlayer((s) => s.lyrics);
  const lyricsStatus = usePlayer((s) => s.lyricsStatus);
  const track = usePlayer((s) => s.track);
  const position = usePlayer((s) => s.position);
  const rate = usePlayer((s) => s.rate);
  const loopLineId = usePlayer((s) => s.loopLineId);
  const toggleLoopLine = usePlayer((s) => s.toggleLoopLine);
  const setRate = usePlayer((s) => s.setRate);
  const retry = usePlayer((s) => s.retry);
  const applyCustomLrc = usePlayer((s) => s.applyCustomLrc);

  const showTranslit = useSettings((s) => s.showTranslit);
  const showTranslation = useSettings((s) => s.showTranslation);
  const lyricBlur = useSettings((s) => s.lyricBlur);
  const aiEnabled = useSettings((s) => s.aiEnabled);
  const t = useT();

  const saveLine = useLibrary((s) => s.saveLine);
  const setClipComposer = useUi((s) => s.setClipComposer);

  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [lrcDraft, setLrcDraft] = useState('');

  const lineIndex = activeLineIndex(lyrics, position);
  const wordIndex = activeWordIndex(lyrics, lineIndex, position);

  // A lookup survives the line advancing — dismissing it is the reader's call,
  // not the playhead's. Only a track change clears it.
  useEffect(() => setSelectedWord(null), [track?.id]);

  const window_ = useMemo(() => {
    if (!lyrics?.lines.length) return [];
    const from = Math.max(0, lineIndex - VISIBLE_RADIUS);
    const to = Math.min(lyrics.lines.length, lineIndex + VISIBLE_RADIUS + 1);
    return lyrics.lines.slice(from, to).map((line, i) => ({ line, index: from + i }));
  }, [lyrics, lineIndex]);

  const panelStyle = { backdropFilter: `blur(${lyricBlur}px)` };

  if (!track) {
    return (
      <div className={`lyricstage lyricstage--${variant}`}>
        <div className="lyricstage__panel empty" style={panelStyle}>
          <span className="empty__icon">✦</span>
          <span>{t('nothingPlaying')}</span>
        </div>
      </div>
    );
  }

  if (lyricsStatus === 'loading') {
    return (
      <div className={`lyricstage lyricstage--${variant}`}>
        <div className="lyricstage__panel lyricstage__panel--status" style={panelStyle}>
          <div className="spinner" />
          <span>{t('loadingLyrics')}</span>
        </div>
      </div>
    );
  }

  if (!lyrics || lyricsStatus === 'error') {
    return (
      <div className={`lyricstage lyricstage--${variant}`}>
        <div className="lyricstage__panel lyricstage__panel--status" style={panelStyle}>
          <span className="empty__icon">✦</span>
          <span>{t('noLyricsPrompt')}</span>
          {pasting ? (
            <div className="lrc-paste">
              <textarea
                className="lrc-paste__area mono"
                value={lrcDraft}
                onChange={(event) => setLrcDraft(event.target.value)}
                placeholder={t('pasteLrcPlaceholder')}
                rows={6}
                autoFocus
              />
              <div className="lrc-paste__actions">
                <button
                  type="button"
                  className="btn btn--accent"
                  disabled={!lrcDraft.trim()}
                  onClick={() => {
                    void applyCustomLrc(lrcDraft);
                    setPasting(false);
                    setLrcDraft('');
                  }}
                >
                  {t('apply')}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setPasting(false);
                    setLrcDraft('');
                  }}
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="lrc-paste__actions">
              {aiEnabled ? (
                <>
                  <button type="button" className="btn btn--accent" onClick={() => void retry()}>
                    {t('create')}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={async () => {
                      try {
                        const res = await api.generateLrc({
                          song: track?.title || 'Unknown',
                          artist: track?.artist || '',
                          ...(track?.durationSec ? { durationSec: track.durationSec } : {}),
                        });
                        await applyCustomLrc(res.lrc);
                      } catch (e) {
                        useUi.getState().toast(t('generateFailed'), 'error');
                        void retry();
                      }
                    }}
                  >
                    {t('generate')}
                  </button>
                </>
              ) : null}
              <button type="button" className="btn" onClick={() => setPasting(true)}>
                {t('pasteLrc')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`lyricstage lyricstage--${variant}`}>
      <div className="lyricstage__panel" style={panelStyle}>
        {lyrics.kind === 'draft' ? (
          <span className="lyricstage__draft mono">
            {t('draftBadge')} · {lyrics.sourceLabel}
          </span>
        ) : null}

        {window_.map(({ line, index }) => {
          const distance = Math.abs(index - lineIndex);
          if (index === lineIndex) {
            return (
              <div className="lyricline lyricline--active" key={line.id}>
                <div className="lyricline__words">
                  {line.words.map((word, i) => {
                    const isActive = i === wordIndex;
                    return (
                      <button
                        type="button"
                        key={`${line.id}-${i}`}
                        className={`word${isActive ? ' word--active' : ''}${
                          selectedWord === word.text ? ' word--selected' : ''
                        }`}
                        onClick={() =>
                          setSelectedWord((current) => (current === word.text ? null : word.text))
                        }
                      >
                        {showTranslit ? (
                          <span className="word__translit mono">{word.translit}</span>
                        ) : null}
                        <span className="word__text">{word.text}</span>
                      </button>
                    );
                  })}
                </div>

                {showTranslation ? (
                  <span className="lyricline__translation">
                    {line.translation || t('noTranslation')}
                  </span>
                ) : null}

                <div className="lyricline__controls">
                  <button
                    type="button"
                    className={`btn${loopLineId === line.id ? ' is-active' : ''}`}
                    onClick={() => toggleLoopLine(line.id)}
                  >
                    {variant === 'mobile' ? t('loopLine') : t('loopLineShort')}
                  </button>
                  {variant === 'mobile' ? (
                    <>
                      <button
                        type="button"
                        className="btn"
                        aria-label={t('saveWord')}
                        onClick={() =>
                          void saveLine({
                            text: line.text,
                            translation: line.translation,
                            trackId: track.id,
                            trackTitle: track.title,
                            startSec: line.time,
                            endSec: line.end,
                          })
                        }
                      >
                        ★
                      </button>
                      <button
                        type="button"
                        className="btn"
                        aria-label={t('clip')}
                        onClick={() => setClipComposer(true)}
                      >
                        ✂
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setRate(cycleRate(rate))}
                      >
                        {rate.toFixed(2).replace(/0$/, '')}×
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          void saveLine({
                            text: line.text,
                            translation: line.translation,
                            trackId: track.id,
                            trackTitle: track.title,
                            startSec: line.time,
                            endSec: line.end,
                          })
                        }
                      >
                        ★
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setClipComposer(true)}
                      >
                        ✂ {CLIP_WINDOW_SEC}с
                      </button>
                    </>
                  )}
                </div>

                {selectedWord ? (
                  <WordPopover
                    word={selectedWord}
                    atSec={line.time}
                    onClose={() => setSelectedWord(null)}
                  />
                ) : null}
              </div>
            );
          }

          return (
            <button
              type="button"
              className="lyricline lyricline--idle"
              key={line.id}
              style={{ opacity: fadeFor(distance) }}
              onClick={() => usePlayer.getState().seek(line.time)}
            >
              {showTranslit ? <span className="lyricline__translit mono">{line.translit}</span> : null}
              <span className="lyricline__text">{line.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
