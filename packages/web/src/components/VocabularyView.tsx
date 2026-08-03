import { createResource, createSignal, For, Show, type JSX } from 'solid-js';
import { api, type ReviewCard } from '../api.js';
import { toast } from '../state/ui.js';

export function VocabularyView(): JSX.Element {
  const [data, { refetch }] = createResource(() => api.vocabulary());

  async function remove(id: number): Promise<void> {
    await api.removeWord(id);
    void refetch();
  }

  function exportCsv(): void {
    const words = data()?.words ?? [];
    const rows = [
      ['lemma', 'surface', 'trackId', 'added', 'reps', 'lapses'],
      ...words.map((word) => [
        word.lemma,
        word.surfaceForm,
        word.trackId ?? '',
        new Date(word.addedAt).toISOString(),
        String(word.reps ?? 0),
        String(word.lapses ?? 0),
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    // U+FEFF is what makes Excel open Cyrillic correctly instead of as mojibake.
    // Written as an escape rather than a literal so it is visible in the source.
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lyrika-vocabulary.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div class="mx-auto w-[min(46rem,92vw)] py-24">
      <div class="flex items-baseline justify-between">
        <h1 class="text-2xl font-semibold text-cyan-50">Словарь</h1>
        <Show when={(data()?.words.length ?? 0) > 0}>
          <button type="button" class="chip" onClick={exportCsv}>
            экспорт CSV
          </button>
        </Show>
      </div>

      <Show when={data()?.due} keyed>
        {(due) => (
          <Show when={due > 0}>
            <p class="mt-2 text-sm text-cyan-200/60">К повторению сейчас: {due}</p>
          </Show>
        )}
      </Show>

      <Show
        when={(data()?.words.length ?? 0) > 0}
        fallback={
          <p class="mt-8 text-cyan-200/45">
            Пока пусто. Нажмите на слово в тексте песни, чтобы сохранить его.
          </p>
        }
      >
        <For each={data()?.words}>
          {(word) => (
            <div class="glass mt-2 flex items-center gap-3 rounded-xl px-4 py-3">
              <div class="min-w-0 flex-1">
                <p class="text-cyan-50">{word.lemma}</p>
                <Show when={word.surfaceForm !== word.lemma}>
                  <p class="text-xs text-cyan-200/40">в песне: {word.surfaceForm}</p>
                </Show>
              </div>
              <Show when={word.due}>
                {(due) => (
                  <span class="font-mono text-[11px] text-cyan-200/40">
                    {new Date(due()).toLocaleDateString('ru-RU')}
                  </span>
                )}
              </Show>
              <button type="button" class="btn-ghost" onClick={() => void remove(word.id)}>
                ✕
              </button>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}

/**
 * The review queue. v2 rendered a "Учить N" button with no handler behind it —
 * this is the screen that button was supposed to open.
 */
export function ReviewView(): JSX.Element {
  const [queue, { refetch }] = createResource(() => api.reviewQueue());
  const [revealed, setRevealed] = createSignal(false);
  const [index, setIndex] = createSignal(0);

  const current = (): ReviewCard | undefined => queue()?.cards[index()];

  async function grade(rating: 1 | 2 | 3 | 4): Promise<void> {
    const card = current();
    if (!card) return;

    try {
      const result = await api.grade(card.cardId, rating);
      const days = Math.round(result.scheduledDays);
      toast(days > 0 ? `Повтор через ${days} дн.` : 'Повтор сегодня');
    } catch {
      toast('Не удалось сохранить оценку');
    }

    setRevealed(false);
    if (index() + 1 >= (queue()?.cards.length ?? 0)) {
      setIndex(0);
      void refetch();
    } else {
      setIndex(index() + 1);
    }
  }

  return (
    <div class="mx-auto w-[min(34rem,92vw)] py-24">
      <h1 class="text-2xl font-semibold text-cyan-50">Повторение</h1>

      <Show
        when={current()}
        fallback={
          <p class="mt-8 text-cyan-200/45">
            На сегодня всё. Сохраняйте слова из песен — они появятся здесь по расписанию.
          </p>
        }
      >
        {(card) => (
          <div class="glass mt-6 rounded-2xl p-8 text-center">
            <p class="text-3xl font-semibold text-cyan-50">{card().lemma}</p>

            <Show
              when={revealed()}
              fallback={
                <button
                  type="button"
                  class="btn btn-primary mt-8"
                  onClick={() => setRevealed(true)}
                >
                  Показать
                </button>
              }
            >
              <Definition word={card().lemma} />

              <div class="mt-8 grid grid-cols-4 gap-2">
                <button type="button" class="chip" onClick={() => void grade(1)}>
                  снова
                </button>
                <button type="button" class="chip" onClick={() => void grade(2)}>
                  трудно
                </button>
                <button type="button" class="chip" onClick={() => void grade(3)}>
                  хорошо
                </button>
                <button type="button" class="chip" onClick={() => void grade(4)}>
                  легко
                </button>
              </div>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}

function Definition(props: { word: string }): JSX.Element {
  const [definition] = createResource(
    () => props.word,
    (word) => api.define(word),
  );

  return (
    <div class="mt-4">
      <p class="font-mono text-sm text-cyan-200/50">{definition()?.romanised}</p>
      <ul class="mt-3 space-y-1">
        <For each={definition()?.senses}>
          {(sense) => <li class="text-cyan-50/85">{sense.gloss}</li>}
        </For>
      </ul>
    </div>
  );
}
