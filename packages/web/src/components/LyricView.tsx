import { createMemo, For, Show, type JSX } from 'solid-js';
import { activeWordIndex, splitWords } from '@lyrika/core';
import {
  currentLineIndex,
  displayWords,
  player,
  seek,
  toggleLineLoop,
} from '../state/player.js';
import { settings } from '../state/settings.js';
import { openWord } from '../state/ui.js';

export function LyricView(): JSX.Element {
  const active = createMemo(() => currentLineIndex());

  return (
    <Show
      when={player.lyrics}
      fallback={
        <div class="flex h-full items-center justify-center px-6 text-center">
          <Show
            when={player.lyricsStatus !== 'loading'}
            fallback={<p class="text-cyan-200/50">Ищем текст…</p>}
          >
            <div>
              <p class="text-cyan-100/70">Текст не найден</p>
              <p class="mt-1 text-sm text-cyan-200/40">
                Загрузите файл вместе с .lrc, чтобы добавить свой.
              </p>
            </div>
          </Show>
        </div>
      }
    >
      {(lyrics) => (
        <div class="mx-auto w-[min(46rem,92vw)] py-24">
          {/* Says plainly where the timing came from. v2 presented interpolated
              word offsets identically to real ones, which is the whole reason
              this label exists. */}
          <p class="mb-6 text-center font-mono text-[11px] uppercase tracking-wider text-cyan-200/35">
            {lyrics().timingKind === 'word'
              ? 'пословная синхронизация'
              : lyrics().timingKind === 'line'
                ? 'построчная синхронизация'
                : 'без синхронизации'}
            <Show when={player.lyricsSource}> · {player.lyricsSource}</Show>
          </p>

          <For each={lyrics().lines}>
            {(line, index) => {
              const isActive = createMemo(() => index() === active());
              const words = createMemo(() => displayWords(line));
              const activeWord = createMemo(() =>
                isActive() ? activeWordIndex(words(), player.positionSec * 1000) : -1,
              );

              return (
                <div
                  class="group relative rounded-2xl px-5 py-3 transition-colors"
                  classList={{
                    'bg-white/[0.04]': isActive(),
                    'opacity-40': !isActive(),
                  }}
                >
                  <Show when={settings.showRomanised}>
                    <p class="mb-1 font-mono text-[13px] leading-relaxed text-cyan-200/50">
                      {line.romanised}
                    </p>
                  </Show>

                  <p class="text-[26px] font-semibold leading-snug text-cyan-50">
                    <Show
                      when={lyrics().timingKind !== 'none'}
                      fallback={<PlainLine text={line.text} lineIdx={index()} />}
                    >
                      <For each={words()}>
                        {(word, wordIndex) => (
                          <button
                            type="button"
                            class="rounded px-0.5 transition-colors hover:bg-cyan-400/20"
                            classList={{
                              'text-cyan-300': wordIndex() === activeWord(),
                              // An interpolated highlight is shown more softly:
                              // it is a good guess, not a measurement.
                              'text-cyan-300/70': wordIndex() === activeWord() && !word.exact,
                            }}
                            onClick={() => openWord(word.text, index())}
                          >
                            {word.text}{' '}
                          </button>
                        )}
                      </For>
                    </Show>
                  </p>

                  <Show when={settings.showTranslation && player.translations.get(line.idx)}>
                    {(translation) => (
                      <p class="mt-1 text-[15px] italic leading-relaxed text-cyan-100/45">
                        {translation()}
                      </p>
                    )}
                  </Show>

                  {/* Controls live inside the line's own block rather than
                      floating over the text, so nothing overlaps the lyrics. */}
                  <div
                    class="mt-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100"
                    classList={{ 'opacity-100': player.loopLineIdx === index() }}
                  >
                    <Show when={line.startMs !== null}>
                      <button
                        type="button"
                        class="chip"
                        classList={{ 'chip-on': player.loopLineIdx === index() }}
                        onClick={() => toggleLineLoop(index())}
                      >
                        ↻ строка
                      </button>
                      <button
                        type="button"
                        class="chip"
                        onClick={() => seek((line.startMs ?? 0) / 1000)}
                      >
                        ⏵ отсюда
                      </button>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      )}
    </Show>
  );
}

/** Unsynced text still gets tappable words — only the timing is missing. */
function PlainLine(props: { text: string; lineIdx: number }): JSX.Element {
  return (
    <For each={splitWords(props.text)}>
      {(word) => (
        <button
          type="button"
          class="rounded px-0.5 hover:bg-cyan-400/20"
          onClick={() => openWord(word.text, props.lineIdx)}
        >
          {word.text}{' '}
        </button>
      )}
    </For>
  );
}
