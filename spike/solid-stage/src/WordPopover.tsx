import { createSignal, onCleanup, createEffect, type JSX } from 'solid-js';
import type { WordDefinition } from '@lyrika/shared';
import { api } from './api';

interface Props {
  word: string;
  onClose: () => void;
}

/**
 * Solid port of client/src/components/WordPopover.tsx. Calls the real
 * `/api/define` endpoint on the Fastify API (proxied by vite.config.ts) —
 * this is the "done criterion #3" surface.
 */
export function WordPopover(props: Props): JSX.Element {
  const [definition, setDefinition] = createSignal<WordDefinition | null>(null);
  const [failed, setFailed] = createSignal(false);

  // React's `useEffect(fn, [word])` becomes a `createEffect` that re-runs
  // whenever `props.word` (read reactively, not destructured) changes.
  createEffect(() => {
    const word = props.word;
    setDefinition(null);
    setFailed(false);
    let cancelled = false;
    void api
      .define(word)
      .then((result) => {
        if (!cancelled) setDefinition(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    onCleanup(() => {
      cancelled = true;
    });
  });

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') props.onClose();
  };
  window.addEventListener('keydown', onKey);
  onCleanup(() => window.removeEventListener('keydown', onKey));

  return (
    <div class="word-pop" role="dialog" aria-label={props.word}>
      <div class="word-pop__head">
        <span class="word-pop__word">{props.word}</span>
        <span class="mono word-pop__meta">
          {definition() ? `${definition()!.translit} · ${definition()!.partOfSpeech}` : '…'}
        </span>
      </div>

      {failed() ? (
        <span class="word-pop__gloss">Словарь недоступен</span>
      ) : (
        <span class="word-pop__gloss">
          {definition() ? definition()!.gloss : 'Ищу значение…'}
          {definition()?.note ? ` — ${definition()!.note}` : ''}
        </span>
      )}

      <div class="word-pop__actions">
        <button type="button" class="btn btn--ghost" onClick={props.onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
