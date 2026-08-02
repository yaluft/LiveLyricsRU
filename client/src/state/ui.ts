import { create } from 'zustand';

export type ViewId = 'now' | 'queue' | 'vocabulary' | 'clips' | 'session' | 'settings';

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'error' | 'success';
  action?: { label: string; run: () => void };
}

interface UiState {
  view: ViewId;
  searchOpen: boolean;
  artistOpen: boolean;
  clipComposerOpen: boolean;
  lyricsEditorOpen: boolean;
  mobileSheetOpen: boolean;
  toasts: Toast[];

  setView: (view: ViewId) => void;
  openSearch: () => void;
  closeSearch: () => void;
  toggleArtist: () => void;
  setClipComposer: (open: boolean) => void;
  setLyricsEditor: (open: boolean) => void;
  setMobileSheet: (open: boolean) => void;
  toast: (message: string, tone?: Toast['tone'], action?: Toast['action']) => void;
  dismissToast: (id: string) => void;
}

const TOAST_MS = 5000;

export const useUi = create<UiState>()((set, get) => ({
  view: 'now',
  searchOpen: false,
  artistOpen: true,
  clipComposerOpen: false,
  lyricsEditorOpen: false,
  mobileSheetOpen: false,
  toasts: [],

  setView: (view) => set({ view, searchOpen: false }),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  toggleArtist: () => set((s) => ({ artistOpen: !s.artistOpen })),
  setClipComposer: (open) => set({ clipComposerOpen: open }),
  setLyricsEditor: (open) => set({ lyricsEditorOpen: open }),
  setMobileSheet: (open) => set({ mobileSheetOpen: open }),

  toast: (message, tone = 'info', action) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, tone, ...(action ? { action } : {}) }] }));
    setTimeout(() => get().dismissToast(id), TOAST_MS);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
