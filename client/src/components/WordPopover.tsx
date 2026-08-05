import { useEffect, useState } from 'react';
import type { WordDefinition } from '@lyrika/shared';
import { api } from '../api';
import { useLibrary } from '../state/library';
import { usePlayer } from '../state/player';
import { useT } from '../state/settings';

interface Props {
  word: string;
  atSec: number;
  onClose: () => void;
}

function speak(word: string): void {
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'ru-RU';
  utterance.rate = 0.85;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

export function WordPopover({ word, atSec, onClose }: Props): JSX.Element {
  const t = useT();
  const [definition, setDefinition] = useState<WordDefinition | null>(null);
  const [failed, setFailed] = useState(false);
  const track = usePlayer((s) => s.track);
  const saveWord = useLibrary((s) => s.saveWord);
  const savedWords = useLibrary((s) => s.words);

  const alreadySaved = savedWords.some((w) => w.word.toLowerCase() === word.toLowerCase());

  useEffect(() => {
    let cancelled = false;
    setDefinition(null);
    setFailed(false);
    api
      .define(word)
      .then((result) => {
        if (!cancelled) setDefinition(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [word]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="word-pop" role="dialog" aria-label={word}>
      <div className="word-pop__head">
        <span className="word-pop__word">{word}</span>
        <span className="mono word-pop__meta">
          {definition ? `${definition.translit} · ${definition.partOfSpeech}` : '…'}
        </span>
      </div>

      {failed ? (
        <span className="word-pop__gloss">Словарь недоступен</span>
      ) : (
        <span className="word-pop__gloss">
          {definition ? definition.gloss : 'Ищу значение…'}
          {definition?.note ? ` — ${definition.note}` : ''}
        </span>
      )}

      <div className="word-pop__actions">
        <button
          type="button"
          className="btn btn--accent word-pop__save"
          disabled={!definition || alreadySaved}
          onClick={() => {
            if (!definition || !track) return;
            void saveWord({
              word: definition.word,
              translit: definition.translit,
              gloss: definition.gloss,
              trackId: track.id,
              trackTitle: track.title,
              atSec,
            });
          }}
        >
          {alreadySaved ? t('saved') : t('saveWord')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => speak(word)}>
          {t('hear')}
        </button>
      </div>
    </div>
  );
}
