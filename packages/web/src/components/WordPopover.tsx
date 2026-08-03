import { createResource, For, Show, type JSX } from 'solid-js';
import { api } from '../api.js';
import { player } from '../state/player.js';
import { closeWord, toast, ui } from '../state/ui.js';

/**
 * Definition card for a tapped word. Playback keeps going behind it — stopping
 * the song to read a gloss is what makes a learning tool feel like homework.
 */
export function WordPopover(): JSX.Element {
  const [definition] = createResource(
    () => ui.wordPopover?.word,
    (word) => api.define(word),
  );

  async function save(): Promise<void> {
    const entry = definition();
    const word = ui.wordPopover?.word;
    if (!word) return;

    try {
      await api.saveWord({
        lemma: entry?.lemma ?? word,
        surfaceForm: word,
        trackId: player.track?.id ?? null,
      });
      toast('Слово сохранено', 'Оно появится в очереди повторения.');
      closeWord();
    } catch {
      toast('Не удалось сохранить слово');
    }
  }

  function speak(): void {
    const word = ui.wordPopover?.word;
    if (!word || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'ru-RU';
    // Slower than natural: the point is to hear the sounds separated.
    utterance.rate = 0.85;
    speechSynthesis.speak(utterance);
  }

  return (
    <Show when={ui.wordPopover}>
      {(popover) => (
        <div class="glass fixed bottom-28 left-1/2 z-40 w-[min(28rem,92vw)] -translate-x-1/2 rounded-2xl p-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="font-mono text-xs text-cyan-200/60">{definition()?.romanised ?? '…'}</p>
              <h2 class="text-2xl font-semibold text-cyan-50">{popover().word}</h2>
              <Show when={definition()?.lemma && definition()?.lemma !== popover().word}>
                <p class="text-sm text-cyan-200/50">→ {definition()?.lemma}</p>
              </Show>
            </div>
            <button type="button" class="btn-ghost" onClick={closeWord} aria-label="Закрыть">
              ✕
            </button>
          </div>

          <Show
            when={definition()?.found}
            fallback={
              <p class="mt-3 text-sm text-cyan-100/60">
                <Show
                  when={definition()?.dictionaryAvailable}
                  fallback="Словарь не установлен — доступно только произношение."
                >
                  Нет в словаре. Произношение выше.
                </Show>
              </p>
            }
          >
            <ul class="mt-3 space-y-2">
              <For each={definition()?.senses}>
                {(sense) => (
                  <li class="text-sm">
                    <Show when={sense.pos}>
                      <span class="mr-2 rounded bg-cyan-400/10 px-1.5 py-0.5 font-mono text-[11px] text-cyan-200/70">
                        {sense.pos}
                      </span>
                    </Show>
                    <span class="text-cyan-50/90">{sense.gloss}</span>
                  </li>
                )}
              </For>
            </ul>
          </Show>

          <div class="mt-4 flex gap-2">
            <button type="button" class="btn" onClick={speak}>
              ▸ Озвучить
            </button>
            <button type="button" class="btn btn-primary" onClick={() => void save()}>
              Сохранить
            </button>
          </div>
        </div>
      )}
    </Show>
  );
}
