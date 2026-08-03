import { createMemo, Show, type JSX } from 'solid-js';
import { clearLoops, markAb, player, seek, setRate, toggle } from '../state/player.js';
import { setSettings, settings } from '../state/settings.js';

const RATES = [0.5, 0.75, 1, 1.25] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function Seekbar(): JSX.Element {
  let track: HTMLDivElement | undefined;

  const percent = createMemo(() =>
    player.durationSec > 0 ? (player.positionSec / player.durationSec) * 100 : 0,
  );

  function seekTo(clientX: number): void {
    if (!track || player.durationSec <= 0) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    seek(ratio * player.durationSec);
  }

  return (
    <div class="flex flex-1 items-center gap-3">
      <span class="w-10 text-right font-mono text-xs text-cyan-200/50">
        {formatTime(player.positionSec)}
      </span>

      <div
        ref={track}
        class="relative h-6 flex-1 cursor-pointer"
        role="slider"
        tabindex="0"
        aria-label="Позиция"
        aria-valuemin={0}
        aria-valuemax={Math.round(player.durationSec)}
        aria-valuenow={Math.round(player.positionSec)}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          seekTo(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.buttons === 1) seekTo(event.clientX);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') seek(player.positionSec - 5);
          if (event.key === 'ArrowRight') seek(player.positionSec + 5);
        }}
      >
        <div class="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-white/10" />
        <div
          class="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-cyan-400"
          style={{ width: `${percent()}%` }}
        />

        {/* A–B markers, so an engaged loop is visible rather than only felt. */}
        <Show when={player.abStart !== null && player.durationSec > 0}>
          <span
            class="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-amber-300"
            style={{ left: `${((player.abStart ?? 0) / player.durationSec) * 100}%` }}
          />
        </Show>
        <Show when={player.abEnd !== null && player.durationSec > 0}>
          <span
            class="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-amber-300"
            style={{ left: `${((player.abEnd ?? 0) / player.durationSec) * 100}%` }}
          />
        </Show>

        <div
          class="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-200 shadow"
          style={{ left: `${percent()}%` }}
        />
      </div>

      <span class="w-10 font-mono text-xs text-cyan-200/50">{formatTime(player.durationSec)}</span>
    </div>
  );
}

export function Transport(): JSX.Element {
  const abLabel = createMemo(() => {
    if (player.abStart === null) return 'A–B';
    if (player.abEnd === null) return 'A · ждём B';
    return 'A–B вкл';
  });

  return (
    <div class="glass fixed inset-x-0 bottom-0 z-30 flex items-center gap-4 px-5 py-3">
      <button
        type="button"
        class="btn btn-primary h-11 w-11 shrink-0 rounded-full text-lg"
        onClick={toggle}
        aria-label={player.playing ? 'Пауза' : 'Играть'}
      >
        {player.playing ? '❚❚' : '▶'}
      </button>

      <div class="hidden min-w-0 shrink-0 sm:block sm:w-48">
        <p class="truncate text-sm text-cyan-50">{player.track?.title ?? 'Ничего не играет'}</p>
        <p class="truncate text-xs text-cyan-200/45">{player.track?.artist ?? ''}</p>
      </div>

      <Seekbar />

      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          class="chip"
          onClick={() => {
            const index = RATES.indexOf(settings.rate as (typeof RATES)[number]);
            const rate = RATES[(index + 1) % RATES.length]!;
            setSettings('rate', rate);
            setRate(rate);
          }}
        >
          {settings.rate}×
        </button>

        <button
          type="button"
          class="chip"
          classList={{ 'chip-on': player.abEnd !== null }}
          onClick={markAb}
        >
          {abLabel()}
        </button>

        <Show when={player.abStart !== null || player.loopLineIdx !== null}>
          <button type="button" class="chip" onClick={clearLoops}>
            сброс
          </button>
        </Show>
      </div>
    </div>
  );
}
