import { useState } from 'react';
import { useLibrary } from '../state/library';
import { usePlayer } from '../state/player';
import { useT } from '../state/settings';
import { useUi } from '../state/ui';
import { formatTime } from '../utils';

type Tab = 'words' | 'lines' | 'clips';

export function VocabularyView(): JSX.Element {
  const t = useT();
  const [tab, setTab] = useState<Tab>('words');

  const words = useLibrary((s) => s.words);
  const lines = useLibrary((s) => s.lines);
  const feed = useLibrary((s) => s.feed);
  const removeWord = useLibrary((s) => s.removeWord);
  const removeLine = useLibrary((s) => s.removeLine);
  const exportCsv = useLibrary((s) => s.exportCsv);

  const seek = usePlayer((s) => s.seek);
  const track = usePlayer((s) => s.track);
  const setClipComposer = useUi((s) => s.setClipComposer);

  const songs = new Set(words.map((w) => w.trackId)).size;
  const mine = feed.filter((c) => c.author === '@вы');

  return (
    <section className="view scroll-y">
      <header className="view__head view__head--split">
        <div className="view__headtext">
          <h1 className="view__title">{t('vocabTitle')}</h1>
          <span className="view__sub">
            {words.length} {t('words')} · {lines.length} {t('lines')} · {songs} {t('songs')}
          </span>
        </div>
        <div className="view__actions">
          <button type="button" className="btn" disabled={!words.length} onClick={exportCsv}>
            {t('exportCsv')}
          </button>
          <button type="button" className="btn btn--primary" disabled={!words.length}>
            {t('studyWords')} {Math.min(words.length, 12)}
          </button>
        </div>
      </header>

      <div className="tabs">
        <button
          type="button"
          className={`chip${tab === 'words' ? ' is-active' : ''}`}
          onClick={() => setTab('words')}
        >
          {t('vocabWords')}
        </button>
        <button
          type="button"
          className={`chip${tab === 'lines' ? ' is-active' : ''}`}
          onClick={() => setTab('lines')}
        >
          {t('vocabLines')}
        </button>
        <button
          type="button"
          className={`chip${tab === 'clips' ? ' is-active' : ''}`}
          onClick={() => setTab('clips')}
        >
          {t('vocabClips')}
        </button>
      </div>

      {tab === 'words' ? (
        words.length === 0 ? (
          <div className="empty">
            <span className="empty__icon">★</span>
            <span>{t('vocabEmpty')}</span>
            <span className="empty__hint">{t('vocabEmptyHint')}</span>
          </div>
        ) : (
          <div className="wordgrid">
            {words.map((word) => (
              <article className="wordcard" key={word.id}>
                <div className="wordcard__head">
                  <span className="wordcard__word">{word.word}</span>
                  <span className="mono wordcard__translit">{word.translit}</span>
                  <button
                    type="button"
                    className="wordcard__remove"
                    onClick={() => void removeWord(word.id)}
                    aria-label={t('remove')}
                  >
                    ✕
                  </button>
                </div>
                <span className="wordcard__gloss">{word.gloss}</span>
                <div className="wordcard__foot">
                  <button
                    type="button"
                    className="mono wordcard__source"
                    onClick={() => {
                      if (track?.id === word.trackId) seek(word.atSec);
                    }}
                  >
                    {word.trackTitle} · {formatTime(word.atSec)}
                  </button>
                  {word.seenCount > 1 ? (
                    <span className="mono wordcard__count">{word.seenCount}×</span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}

      {tab === 'lines' ? (
        lines.length === 0 ? (
          <div className="empty">
            <span className="empty__icon">≡</span>
            <span>{t('vocabEmpty')}</span>
          </div>
        ) : (
          <div className="stack">
            <span className="label">{t('savedLines')}</span>
            {lines.map((line) => (
              <div className="linecard" key={line.id}>
                <div className="linecard__text">
                  <span className="linecard__ru">{line.text}</span>
                  <span className="linecard__en">{line.translation || t('noTranslation')}</span>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    if (track?.id === line.trackId) seek(line.startSec);
                  }}
                >
                  {t('repeat')}
                </button>
                <button type="button" className="btn btn--accent" onClick={() => setClipComposer(true)}>
                  {t('clip')}
                </button>
                <button
                  type="button"
                  className="row__remove"
                  onClick={() => void removeLine(line.id)}
                  aria-label={t('remove')}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )
      ) : null}

      {tab === 'clips' ? (
        mine.length === 0 ? (
          <div className="empty">
            <span className="empty__icon">✂</span>
            <span>{t('vocabEmpty')}</span>
          </div>
        ) : (
          <div className="stack stack--tight">
            {mine.map((clip) => (
              <div className="row" key={clip.id}>
                <div className="clipcard__thumb" />
                <div className="row__meta">
                  <span className="row__title">«{clip.lineText}»</span>
                  <span className="row__sub">
                    {clip.trackTitle} · {formatTime(clip.startSec)}–{formatTime(clip.endSec)}
                  </span>
                </div>
                <span className="mono row__sub">{clip.likes} ♥</span>
              </div>
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}
