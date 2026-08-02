import { useEffect, useState } from 'react';
import type { AiExplainResponse } from '@lyrika/shared';
import { ApiFailure, api } from '../api';
import { useT } from '../state/settings';
import { useEscape } from '../useEscape';

interface Props {
  text: string;
  trackTitle: string;
  artist: string;
  /** The ±2 surrounding lines, so the assistant reads the line in context. */
  context: string[];
  onClose: () => void;
}

export function LineExplain({ text, trackTitle, artist, context, onClose }: Props): JSX.Element {
  const t = useT();
  const [result, setResult] = useState<AiExplainResponse | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // The array identity changes every render; the joined text does not.
  const contextKey = context.join('\n');

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setFailure(null);
    api
      .aiExplain({
        text,
        trackTitle,
        artist,
        context: contextKey ? contextKey.split('\n') : [],
      })
      .then((response) => {
        if (!cancelled) setResult(response);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // ApiFailure carries the server's Russian copy — keep it verbatim.
        setFailure(error instanceof ApiFailure ? error.message : '');
      });
    return () => {
      cancelled = true;
    };
  }, [text, trackTitle, artist, contextKey]);

  useEscape(onClose);

  return (
    <div className="word-pop line-explain" role="dialog" aria-label={t('explainTitle')}>
      <div className="word-pop__head">
        <span className="word-pop__word">{t('explainTitle')}</span>
        {result?.simulated ? <span className="mono word-pop__meta">{t('simulatedBadge')}</span> : null}
      </div>

      {failure !== null ? (
        <span className="word-pop__gloss">{failure || t('explainFailed')}</span>
      ) : !result ? (
        <span className="word-pop__gloss">{t('explainPending')}</span>
      ) : (
        <>
          <div className="line-explain__block">
            <span className="label">{t('explainMeaning')}</span>
            <span className="word-pop__gloss">{result.meaning}</span>
          </div>

          <div className="line-explain__block">
            <span className="label">{t('explainLiteral')}</span>
            <span className="word-pop__gloss">{result.literal}</span>
          </div>

          {result.notes.length ? (
            <div className="line-explain__block">
              <span className="label">{t('explainNotes')}</span>
              <ul className="line-explain__notes">
                {result.notes.map((note, index) => (
                  <li key={index} className="word-pop__gloss">
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}

      <div className="word-pop__actions">
        <button type="button" className="btn btn--ghost word-pop__save" onClick={onClose}>
          {t('close')}
        </button>
      </div>
    </div>
  );
}
