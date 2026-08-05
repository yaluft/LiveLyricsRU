import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LyricSourceId, WavePreset } from '@lyrika/shared';
import type { Lang, StringKey } from '../i18n';
import { translate } from '../i18n';

export type LayoutId = 'stage' | 'studio';

export interface LyricSource {
  id: LyricSourceId;
  enabled: boolean;
  url?: string;
}

interface SettingsState {
  lang: Lang;
  layout: LayoutId;
  wavePreset: WavePreset;
  waveHeight: number;
  reactivity: number;
  lyricBlur: number;
  ecoMode: boolean;
  showTranslit: boolean;
  showTranslation: boolean;
  sources: LyricSource[];
  aiEnabled: boolean;
  aiAuto: boolean;
  aiTranslit: boolean;
  aiTranslation: boolean;
  aiShare: boolean;

  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  toggleSource: (id: LyricSourceId) => void;
  moveSource: (id: LyricSourceId, direction: -1 | 1) => void;
}

const DEFAULT_SOURCES: LyricSource[] = [
  { id: 'lrclib', enabled: true },
  { id: 'genius', enabled: true },
  { id: 'custom', enabled: false },
];

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      lang: 'ru',
      layout: 'stage',
      wavePreset: 'calm',
      waveHeight: 0.62,
      reactivity: 0.45,
      lyricBlur: 28,
      ecoMode: false,
      showTranslit: true,
      showTranslation: true,
      sources: DEFAULT_SOURCES,
      aiEnabled: true,
      aiAuto: true,
      aiTranslit: true,
      aiTranslation: true,
      aiShare: false,

      set: (key, value) => set({ [key]: value } as Partial<SettingsState>),

      toggleSource: (id) =>
        set((state) => ({
          sources: state.sources.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
        })),

      moveSource: (id, direction) =>
        set((state) => {
          const index = state.sources.findIndex((s) => s.id === id);
          const target = index + direction;
          if (index === -1 || target < 0 || target >= state.sources.length) return state;
          const next = [...state.sources];
          const [moved] = next.splice(index, 1);
          if (moved) next.splice(target, 0, moved);
          return { sources: next };
        }),
    }),
    {
      name: 'lyrika.settings',
      version: 1,
    },
  ),
);

/** Reads the current language reactively and returns a translator bound to it. */
export function useT(): (key: StringKey) => string {
  const lang = useSettings((s) => s.lang);
  return (key: StringKey) => translate(key, lang);
}
