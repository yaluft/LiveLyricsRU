import { createEffect, For, onCleanup, onMount, Show, Switch, Match, type JSX } from 'solid-js';
import { LyricView } from './components/LyricView.jsx';
import { OceanBackground } from './components/OceanBackground.jsx';
import { SearchView } from './components/SearchView.jsx';
import { SettingsView } from './components/SettingsView.jsx';
import { Transport } from './components/Transport.jsx';
import { ReviewView, VocabularyView } from './components/VocabularyView.jsx';
import { WordPopover } from './components/WordPopover.jsx';
import { player, seek, toggle } from './state/player.js';
import { oceanParams } from './state/settings.js';
import { closeWord, dismissToast, setView, ui, type View } from './state/ui.js';

const NAV: { id: View; label: string }[] = [
  { id: 'stage', label: 'Сцена' },
  { id: 'search', label: 'Поиск' },
  { id: 'vocabulary', label: 'Словарь' },
  { id: 'review', label: 'Повторение' },
  { id: 'settings', label: 'Настройки' },
];

export function App(): JSX.Element {
  onMount(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      // Never steal keys from a field the user is typing in.
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (event.code === 'Space') {
        event.preventDefault();
        toggle();
      }
      if (event.key === 'ArrowLeft') seek(player.positionSec - 5);
      if (event.key === 'ArrowRight') seek(player.positionSec + 5);
      if (event.key === '/') {
        event.preventDefault();
        setView('search');
      }
      if (event.key === 'Escape') closeWord();
    };

    window.addEventListener('keydown', onKey);
    onCleanup(() => window.removeEventListener('keydown', onKey));
  });

  // The ocean's palette is mirrored onto CSS custom properties so the eco-mode
  // gradient and the glass panels stay in step with the WebGL surface.
  createEffect(() => {
    const params = oceanParams(0);
    const root = document.documentElement;
    root.style.setProperty('--ocean-sky', params.fog);
    root.style.setProperty('--ocean-surface', params.surface);
    root.style.setProperty('--ocean-atmosphere', params.atmosphere);
    root.style.setProperty('--lyric-blur', `${params.lyricBlur}px`);
  });

  return (
    <div class="min-h-dvh text-cyan-50">
      <OceanBackground />

      {/* The nav never auto-hides. v2's dock appearing and disappearing on its
          own was the single most-complained-about thing about v1. */}
      <nav class="glass fixed inset-x-0 top-0 z-30 flex items-center gap-1 px-4 py-2">
        <span class="mr-3 font-semibold tracking-tight">Лирика</span>
        <For each={NAV}>
          {(item) => (
            <button
              type="button"
              class="chip"
              classList={{ 'chip-on': ui.view === item.id }}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          )}
        </For>
      </nav>

      <main class="pb-24">
        <Switch>
          <Match when={ui.view === 'stage'}>
            <Show
              when={player.track}
              fallback={
                <div class="mx-auto w-[min(34rem,92vw)] py-32 text-center">
                  <h1 class="text-3xl font-semibold">Слушайте и читайте</h1>
                  <p class="mt-3 text-cyan-200/50">
                    Найдите песню или загрузите свой файл — с текстом .lrc, если он есть.
                  </p>
                  <button type="button" class="btn btn-primary mt-6" onClick={() => setView('search')}>
                    Начать
                  </button>
                </div>
              }
            >
              <LyricView />
            </Show>
          </Match>
          <Match when={ui.view === 'search'}>
            <SearchView />
          </Match>
          <Match when={ui.view === 'vocabulary'}>
            <VocabularyView />
          </Match>
          <Match when={ui.view === 'review'}>
            <ReviewView />
          </Match>
          <Match when={ui.view === 'settings'}>
            <SettingsView />
          </Match>
        </Switch>
      </main>

      <Show when={player.error}>
        {(message) => (
          <div class="glass fixed left-1/2 top-16 z-40 w-[min(28rem,92vw)] -translate-x-1/2 rounded-xl px-4 py-3">
            <p class="text-sm text-rose-200">{message()}</p>
            <Show when={player.hint}>
              <p class="mt-1 text-sm text-cyan-200/50">{player.hint}</p>
            </Show>
          </div>
        )}
      </Show>

      <WordPopover />
      <Show when={player.track}>
        <Transport />
      </Show>

      <div class="fixed bottom-24 right-4 z-40 space-y-2">
        <For each={ui.toasts}>
          {(entry) => (
            <button
              type="button"
              class="glass block w-72 rounded-xl px-4 py-3 text-left"
              onClick={() => dismissToast(entry.id)}
            >
              <p class="text-sm text-cyan-50">{entry.message}</p>
              <Show when={entry.hint}>
                <p class="mt-0.5 text-xs text-cyan-200/50">{entry.hint}</p>
              </Show>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
