import { For, type JSX } from 'solid-js';
import { THEMES, type OceanParams } from '../bg/params.js';
import {
  oceanParams,
  resetOceanOverrides,
  setOceanParam,
  setSettings,
  settings,
} from '../state/settings.js';

/**
 * Split by value type so a slider can only ever address a numeric uniform and a
 * colour picker only a colour. Keying both off `keyof OceanParams` forces the
 * setter's value to the intersection of every parameter type, which is what
 * tempts an `as never` cast — and that cast would happily assign a hex string
 * to `specularPower`.
 */
type NumericKey = {
  [K in keyof OceanParams]: OceanParams[K] extends number ? K : never;
}[keyof OceanParams];

type ColourKey = {
  [K in keyof OceanParams]: OceanParams[K] extends string ? K : never;
}[keyof OceanParams];

interface SliderSpec {
  key: NumericKey;
  label: string;
  min: number;
  max: number;
  step: number;
}

/** Every uniform the shader reads. v2 exposed three of these. */
const SLIDERS: SliderSpec[] = [
  { key: 'height', label: 'Высота волн', min: 0, max: 2, step: 0.01 },
  { key: 'steepness', label: 'Крутизна', min: 0, max: 1.2, step: 0.01 },
  { key: 'windDirection', label: 'Направление ветра', min: 0, max: 6.28, step: 0.01 },
  { key: 'windSpeed', label: 'Скорость ветра', min: 0, max: 3, step: 0.01 },
  { key: 'choppiness', label: 'Разброс волн', min: 0, max: 1.5, step: 0.01 },
  { key: 'foamThreshold', label: 'Порог пены', min: 0, max: 1.5, step: 0.01 },
  { key: 'foamAmount', label: 'Количество пены', min: 0, max: 1, step: 0.01 },
  { key: 'lightAzimuth', label: 'Азимут света', min: 0, max: 6.28, step: 0.01 },
  { key: 'lightElevation', label: 'Высота света', min: 0, max: 1.57, step: 0.01 },
  { key: 'specularPower', label: 'Резкость бликов', min: 4, max: 200, step: 1 },
  { key: 'specularStrength', label: 'Сила бликов', min: 0, max: 1.5, step: 0.01 },
  { key: 'reactivity', label: 'Реакция на звук', min: 0, max: 1.5, step: 0.01 },
  { key: 'lyricBlur', label: 'Размытие под текстом', min: 0, max: 60, step: 1 },
];

const COLOURS: { key: ColourKey; label: string }[] = [
  { key: 'fog', label: 'Даль' },
  { key: 'surface', label: 'Поверхность' },
  { key: 'atmosphere', label: 'Атмосфера' },
];

export function SettingsView(): JSX.Element {
  // Sampled at 0 so the controls show the theme's own starting values rather
  // than wherever an animated theme currently happens to be.
  const current = (): OceanParams => oceanParams(0);

  function exportPreset(): void {
    const json = JSON.stringify(current(), null, 2);
    void navigator.clipboard?.writeText(json);
  }

  return (
    <div class="mx-auto w-[min(46rem,92vw)] py-24">
      <h1 class="text-2xl font-semibold text-cyan-50">Настройки</h1>

      <section class="mt-6">
        <h2 class="text-sm uppercase tracking-wide text-cyan-200/45">Тема воды</h2>
        <div class="mt-2 flex flex-wrap gap-2">
          <For each={THEMES}>
            {(theme) => (
              <button
                type="button"
                class="chip"
                classList={{ 'chip-on': settings.themeId === theme.id }}
                onClick={() => setSettings('themeId', theme.id)}
              >
                {theme.name}
                {theme.keyframes ? ' ·◷' : ''}
              </button>
            )}
          </For>
        </div>
        <p class="mt-2 text-xs text-cyan-200/35">
          ◷ — тема меняется со временем, проходя полный цикл сама по себе.
        </p>
      </section>

      <section class="mt-8">
        <div class="flex items-baseline justify-between">
          <h2 class="text-sm uppercase tracking-wide text-cyan-200/45">Вода</h2>
          <div class="flex gap-2">
            <button type="button" class="chip" onClick={exportPreset}>
              скопировать пресет
            </button>
            <button type="button" class="chip" onClick={resetOceanOverrides}>
              сбросить
            </button>
          </div>
        </div>

        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <For each={SLIDERS}>
            {(spec) => (
              <label class="block">
                <span class="flex justify-between text-xs text-cyan-200/55">
                  {spec.label}
                  <span class="font-mono text-cyan-200/35">
                    {current()[spec.key].toFixed(2)}
                  </span>
                </span>
                <input
                  type="range"
                  class="mt-1 w-full accent-cyan-400"
                  min={spec.min}
                  max={spec.max}
                  step={spec.step}
                  value={current()[spec.key]}
                  onInput={(event) => setOceanParam(spec.key, Number(event.currentTarget.value))}
                />
              </label>
            )}
          </For>
        </div>

        <div class="mt-4 flex flex-wrap gap-4">
          <For each={COLOURS}>
            {(colour) => (
              <label class="flex items-center gap-2 text-xs text-cyan-200/55">
                {colour.label}
                <input
                  type="color"
                  class="h-7 w-10 rounded border border-white/10 bg-transparent"
                  value={current()[colour.key]}
                  onInput={(event) => setOceanParam(colour.key, event.currentTarget.value)}
                />
              </label>
            )}
          </For>
        </div>
      </section>

      <section class="mt-8 space-y-2">
        <h2 class="text-sm uppercase tracking-wide text-cyan-200/45">Текст</h2>
        <Toggle
          label="Показывать произношение"
          value={settings.showRomanised}
          onChange={(value) => setSettings('showRomanised', value)}
        />
        <Toggle
          label="Показывать перевод"
          value={settings.showTranslation}
          onChange={(value) => setSettings('showTranslation', value)}
        />
        <Toggle
          label="Эко-режим (без WebGL)"
          value={settings.ecoMode}
          onChange={(value) => setSettings('ecoMode', value)}
        />
        <p class="text-xs text-cyan-200/35">Эко-режим применяется после перезагрузки страницы.</p>
      </section>
    </div>
  );
}

function Toggle(props: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <label class="flex items-center gap-3 text-sm text-cyan-100/75">
      <input
        type="checkbox"
        class="h-4 w-4 accent-cyan-400"
        checked={props.value}
        onChange={(event) => props.onChange(event.currentTarget.checked)}
      />
      {props.label}
    </label>
  );
}
