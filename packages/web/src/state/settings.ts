import { createEffect, createRoot } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { resolveTheme, themeById, type OceanParams } from '../bg/params.js';

const KEY = 'lyrika.settings.v3';

export type Lang = 'ru' | 'en' | 'both';

export interface Settings {
  lang: Lang;
  themeId: string;
  /** Per-parameter overrides on top of the chosen theme. */
  oceanOverrides: Partial<OceanParams>;
  ecoMode: boolean;
  showRomanised: boolean;
  showTranslation: boolean;
  rate: number;
  volume: number;
}

const DEFAULTS: Settings = {
  lang: 'both',
  themeId: 'calm',
  oceanOverrides: {},
  ecoMode: false,
  showRomanised: true,
  showTranslation: true,
  rate: 1,
  volume: 1,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    // Spread over the defaults so a settings blob written by an older build
    // gains new keys rather than leaving them undefined.
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export const [settings, setSettings] = createStore<Settings>(load());

// Wrapped in createRoot because this effect is created at module scope rather
// than inside a component. Without a root it belongs to no owner, can never be
// disposed, and Solid warns about exactly that.
createRoot(() => {
  createEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // Private mode, or the quota is full. Losing preferences is not worth
      // breaking the app over.
    }
  });
});

/** The theme's values with the user's overrides applied on top. */
export function oceanParams(elapsedSec: number): OceanParams {
  const theme = themeById(settings.themeId);
  return { ...resolveTheme(theme, elapsedSec), ...settings.oceanOverrides };
}

export function setOceanParam<K extends keyof OceanParams>(key: K, value: OceanParams[K]): void {
  setSettings('oceanOverrides', key, value);
}

export function resetOceanOverrides(): void {
  // `setSettings('oceanOverrides', {})` would *merge* an empty object — a
  // no-op that leaves every override in place, so the reset button appears to
  // do nothing. `reconcile` replaces the value outright.
  setSettings('oceanOverrides', reconcile({}));
}
