import { useCallback, useMemo, useState } from 'react';
import type { Lyrics } from '@lyrika/shared';
import { ApiFailure, api } from '../api';
import { usePlayer } from '../state/player';
import { useSettings, useT } from '../state/settings';
import { useUi } from '../state/ui';
import { useEscape } from '../useEscape';

/** An LRC stamp anywhere in a row: [00:21.12], [1:02:33.4], [00:21:12]. */
const TIMESTAMP_RE = /\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/;

type Busy = 'idle' | 'saving' | 'deleting' | 'ai';

function lrcStamp(seconds: number): string {
  const total = Math.max(0, seconds);
  const minutes = Math.floor(total / 60);
  const rest = total - minutes * 60;
  return `[${String(minutes).padStart(2, '0')}:${rest.toFixed(2).padStart(5, '0')}]`;
}

/** Renders lyrics back into the LRC-ish text the editor speaks. */
function toEditorText(lyrics: Lyrics | null): string {
  if (!lyrics?.lines.length) return '';
  const timed = lyrics.kind !== 'plain';
  return lyrics.lines
    .map((line) => (timed ? `${lrcStamp(line.time)} ${line.text}` : line.text))
    .join('\n');
}

/**
 * Every failure out of `api` is an `ApiFailure` carrying the server's Russian
 * copy, so surface that rather than inventing our own wording.
 */
function failureText(error: unknown, fallback: string): string {
  if (!(error instanceof ApiFailure)) return fallback;
  return error.hint ? `${error.message} — ${error.hint}` : error.message;
}

export function LyricsEditor(): JSX.Element | null {
  const t = useT();
  const track = usePlayer((s) => s.track);
  const lyrics = usePlayer((s) => s.lyrics);

  const setLyricsEditor = useUi((s) => s.setLyricsEditor);
  const toast = useUi((s) => s.toast);
  const aiTranslit = useSettings((s) => s.aiTranslit);
  const aiTranslation = useSettings((s) => s.aiTranslation);

  const [body, setBody] = useState(() => toEditorText(lyrics));
  const [busy, setBusy] = useState<Busy>('idle');

  const close = useCallback(() => setLyricsEditor(false), [setLyricsEditor]);
  useEscape(close);

  // Client-side only: the authoritative parse happens on the server.
  const parsed = useMemo(() => {
    const rows = body
      .split('\n')
      .map((row) => row.trim())
      .filter(Boolean);
    return { count: rows.length, synced: rows.some((row) => TIMESTAMP_RE.test(row)) };
  }, [body]);

  if (!track) return null;

  const working = busy !== 'idle';
  const hasCustom = lyrics?.source === 'custom';

  const fillFromAi = async (): Promise<void> => {
    setBusy('ai');
    try {
      const response = await api.aiLyrics({
        query: `${track.artist} — ${track.title}`,
        trackId: track.id,
        durationSec: track.durationSec,
        withTranslit: aiTranslit,
        withTranslation: aiTranslation,
      });
      // Deliberately not saved: the user reviews the draft first.
      setBody(toEditorText(response.lyrics));
      toast(t('aiFilledEditor'), 'info');
    } catch (error) {
      toast(failureText(error, 'Ассистент недоступен'), 'error');
    } finally {
      setBusy('idle');
    }
  };

  const save = async (): Promise<void> => {
    setBusy('saving');
    try {
      const saved = await api.saveCustomLyrics({
        trackId: track.id,
        body,
        durationSec: track.durationSec,
        title: track.title,
        artist: track.artist,
      });
      usePlayer.getState().applyLyrics(saved);
      toast(t('lyricsSaved'), 'success');
      close();
    } catch (error) {
      toast(failureText(error, 'Не удалось сохранить текст'), 'error');
      setBusy('idle');
    }
  };

  const remove = async (): Promise<void> => {
    setBusy('deleting');
    try {
      await api.deleteCustomLyrics(track.id);
      toast(t('lyricsDeleted'), 'success');
      close();
      // Fall back to whatever the remote chain answers now.
      void usePlayer.getState().reloadLyrics();
    } catch (error) {
      toast(failureText(error, 'Не удалось удалить текст'), 'error');
      setBusy('idle');
    }
  };

  return (
    <div
      className="modal-scrim"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div className="modal modal--lyricedit">
        <div className="modal__head">
          <span className="modal__title">{t('lyricsEditorTitle')}</span>
          <span className="mono modal__meta">
            {track.artist} — {track.title}
          </span>
        </div>

        <div className="modal__body">
          <span className="lyricedit__hint">{t('lyricsEditorHint')}</span>

          <textarea
            className="lyricedit__area"
            value={body}
            spellCheck={false}
            placeholder={t('lyricsEditorPlaceholder')}
            aria-label={t('lyricsEditorTitle')}
            onChange={(event) => setBody(event.target.value)}
          />

          <span className="mono lyricedit__parse">
            {parsed.count === 0
              ? t('lyricsEditorEmpty')
              : `${parsed.count} ${t('lyricsEditorParsed')} · ${
                  parsed.synced ? t('lyricsEditorSynced') : t('lyricsEditorPlain')
                }`}
          </span>

          <div className="lyricedit__actions">
            <button type="button" className="btn" disabled={working} onClick={() => void fillFromAi()}>
              {busy === 'ai' ? '…' : t('fillFromAi')}
            </button>
            <button
              type="button"
              className="btn btn--primary lyricedit__save"
              disabled={working || parsed.count === 0}
              onClick={() => void save()}
            >
              {busy === 'saving' ? '…' : t('lyricsEditorSave')}
            </button>
            {hasCustom ? (
              <button
                type="button"
                className="btn btn--danger"
                disabled={working}
                onClick={() => void remove()}
              >
                {busy === 'deleting' ? '…' : t('lyricsEditorDelete')}
              </button>
            ) : null}
            <button type="button" className="btn btn--ghost" disabled={working} onClick={close}>
              {t('cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
