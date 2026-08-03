import { createSignal, For, Show, type JSX } from 'solid-js';
import type { Track } from '@lyrika/core';
import { api, ApiFailure } from '../api.js';
import { enqueue, playTrack } from '../state/player.js';
import { setView, toast } from '../state/ui.js';

/**
 * Search and upload sit on one screen because they are the same intent: get a
 * song in. Upload is not a fallback here — without yt-dlp it is the *only*
 * path, so it gets equal billing rather than a footnote.
 */
export function SearchView(): JSX.Element {
  const [query, setQuery] = createSignal('');
  const [results, setResults] = createSignal<Track[]>([]);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<{ message: string; hint?: string } | null>(null);

  async function run(event: Event): Promise<void> {
    event.preventDefault();
    const q = query().trim();
    if (!q) return;

    setBusy(true);
    setError(null);
    try {
      const response = await api.search(q);
      setResults(response.results);
      if (response.results.length === 0) {
        setError({ message: 'Ничего не найдено', hint: 'Попробуйте вставить ссылку.' });
      }
    } catch (failure) {
      const api = failure instanceof ApiFailure ? failure : null;
      setError({
        message: api?.message ?? 'Поиск не удался',
        ...(api?.hint ? { hint: api.hint } : {}),
      });
      setResults([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="mx-auto w-[min(46rem,92vw)] py-24">
      <form onSubmit={(event) => void run(event)} class="flex gap-2">
        <input
          class="glass flex-1 rounded-xl px-4 py-3 text-cyan-50 outline-none placeholder:text-cyan-200/30"
          placeholder="Название песни или ссылка на YouTube / VK"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
        <button type="submit" class="btn btn-primary px-5" disabled={busy()}>
          {busy() ? '…' : 'Найти'}
        </button>
      </form>

      <Show when={error()}>
        {(value) => (
          <div class="glass mt-4 rounded-xl px-4 py-3">
            <p class="text-sm text-rose-200">{value().message}</p>
            <Show when={value().hint}>
              <p class="mt-1 text-sm text-cyan-200/50">{value().hint}</p>
            </Show>
          </div>
        )}
      </Show>

      <UploadPanel />

      <For each={results()}>
        {(track) => (
          <div class="glass mt-2 flex items-center gap-3 rounded-xl px-4 py-3">
            <Show when={track.thumbUrl}>
              {(url) => <img src={url()} alt="" class="h-11 w-11 rounded object-cover" />}
            </Show>
            <div class="min-w-0 flex-1">
              <p class="truncate text-cyan-50">{track.title}</p>
              <p class="truncate text-sm text-cyan-200/45">{track.artist}</p>
            </div>
            <button type="button" class="chip" onClick={() => enqueue(track)}>
              в очередь
            </button>
            <button
              type="button"
              class="btn btn-primary"
              onClick={() => {
                setView('stage');
                void playTrack(track);
              }}
            >
              Играть
            </button>
          </div>
        )}
      </For>
    </div>
  );
}

function UploadPanel(): JSX.Element {
  const [busy, setBusy] = createSignal(false);
  let audioInput: HTMLInputElement | undefined;
  let lrcInput: HTMLInputElement | undefined;

  /**
   * Duration is read here rather than probed server-side, which would mean
   * depending on ffmpeg. An object URL gives the browser's own decoder.
   */
  function readDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      const done = (value: number): void => {
        URL.revokeObjectURL(url);
        resolve(value);
      };
      audio.addEventListener('loadedmetadata', () => done(Math.round(audio.duration) || 0), {
        once: true,
      });
      audio.addEventListener('error', () => done(0), { once: true });
      setTimeout(() => done(0), 5000);
    });
  }

  async function submit(): Promise<void> {
    const file = audioInput?.files?.[0];
    if (!file) return;

    setBusy(true);
    try {
      const form = new FormData();
      form.set('audio', file, file.name);
      form.set('title', file.name.replace(/\.[^.]+$/, ''));
      form.set('durationSec', String(await readDuration(file)));

      const lrc = lrcInput?.files?.[0];
      if (lrc) form.set('lrc', await lrc.text());

      const { track, lyrics } = await api.upload(form);
      setView('stage');
      void playTrack(track);

      if (lyrics) {
        toast(
          'Файл загружен',
          lyrics.timingKind === 'word'
            ? 'Текст с пословной синхронизацией.'
            : 'Текст с построчной синхронизацией.',
        );
      }
    } catch (failure) {
      const error = failure instanceof ApiFailure ? failure : null;
      toast(error?.message ?? 'Не удалось загрузить файл', error?.hint);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="glass mt-6 rounded-xl p-4">
      <p class="text-sm text-cyan-50">Свой файл</p>
      <p class="mt-0.5 text-xs text-cyan-200/45">
        Работает всегда — без интернета и без yt-dlp. Можно приложить .lrc.
      </p>

      <div class="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={audioInput}
          type="file"
          accept="audio/*"
          class="text-sm text-cyan-100/70 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400/15 file:px-3 file:py-1.5 file:text-cyan-100"
        />
        <input
          ref={lrcInput}
          type="file"
          accept=".lrc,text/plain"
          class="text-sm text-cyan-100/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/5 file:px-3 file:py-1.5 file:text-cyan-100/70"
        />
        <button type="button" class="btn btn-primary" disabled={busy()} onClick={() => void submit()}>
          {busy() ? 'Загрузка…' : 'Загрузить'}
        </button>
      </div>
    </div>
  );
}
