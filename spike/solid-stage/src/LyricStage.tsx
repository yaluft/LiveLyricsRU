import { createSignal, createMemo, For, type JSX } from 'solid-js';
import { activeLineIndex, activeWordIndex, playerState, seek } from './store';
import { WordPopover } from './WordPopover';

const VISIBLE_RADIUS = 2;

function fadeFor(distance: number): number {
  if (distance === 1) return 0.52;
  if (distance === 2) return 0.3;
  return 0.2;
}

/**
 * Solid port of client/src/components/LyricStage.tsx, trimmed to line
 * highlighting + word-tap (loop-line, save-word, clip, translation toggle,
 * rate-cycling are out of scope for this spike).
 */
export function LyricStage(): JSX.Element {
  const [selectedWord, setSelectedWord] = createSignal<string | null>(null);

  const lineIndex = createMemo(() => activeLineIndex(playerState.lyrics, playerState.position));
  const wordIndex = createMemo(() => activeWordIndex(playerState.lyrics, lineIndex(), playerState.position));

  const windowLines = createMemo(() => {
    const lyrics = playerState.lyrics;
    if (!lyrics?.lines.length) return [];
    const idx = lineIndex();
    const from = Math.max(0, idx - VISIBLE_RADIUS);
    const to = Math.min(lyrics.lines.length, idx + VISIBLE_RADIUS + 1);
    return lyrics.lines.slice(from, to).map((line, i) => ({ line, index: from + i }));
  });

  return (
    <div class="lyricstage lyricstage--stage">
      {!playerState.track ? (
        <div class="lyricstage__panel empty">
          <span class="empty__icon">✦</span>
          <span>Ничего не играет</span>
        </div>
      ) : playerState.lyricsStatus === 'loading' ? (
        <div class="lyricstage__panel lyricstage__panel--status">
          <div class="spinner" />
          <span>Загружаю текст…</span>
        </div>
      ) : !playerState.lyrics || playerState.lyricsStatus === 'error' ? (
        <div class="lyricstage__panel lyricstage__panel--status">
          <span class="empty__icon">✦</span>
          <span>Текст не найден</span>
        </div>
      ) : (
        <div class="lyricstage__panel">
          {/* `<For>` (not `.map()`) is the Solid-idiomatic list primitive: it
             keys by referential identity of each item and only patches the
             DOM nodes that actually changed, rather than re-mounting the
             window every position tick the way a naive `.map()` would. */}
          <For each={windowLines()}>
            {({ line, index }) => {
              const distance = () => Math.abs(index - lineIndex());
              const isActiveLine = () => index === lineIndex();

              return (
                <>
                  {isActiveLine() ? (
                    <div class="lyricline lyricline--active">
                      <div class="lyricline__words">
                        <For each={line.words}>
                          {(word, i) => {
                            const isActive = () => i() === wordIndex();
                            const isSelected = () => selectedWord() === word.text;
                            return (
                              <button
                                type="button"
                                class={`word${isActive() ? ' word--active' : ''}${isSelected() ? ' word--selected' : ''}`}
                                onClick={() =>
                                  setSelectedWord((current) => (current === word.text ? null : word.text))
                                }
                              >
                                <span class="word__translit mono">{word.translit}</span>
                                <span class="word__text">{word.text}</span>
                              </button>
                            );
                          }}
                        </For>
                      </div>

                      <span class="lyricline__translation">{line.translation || '—'}</span>

                      {selectedWord() ? (
                        <WordPopover word={selectedWord()!} onClose={() => setSelectedWord(null)} />
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      class="lyricline lyricline--idle"
                      style={{ opacity: fadeFor(distance()) }}
                      onClick={() => seek(line.time)}
                    >
                      <span class="lyricline__translit mono">{line.translit}</span>
                      <span class="lyricline__text">{line.text}</span>
                    </button>
                  )}
                </>
              );
            }}
          </For>
        </div>
      )}
    </div>
  );
}
