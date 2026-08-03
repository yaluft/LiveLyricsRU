import { createStore } from 'solid-js/store';

export type View = 'stage' | 'search' | 'vocabulary' | 'review' | 'settings';

export interface Toast {
  id: number;
  message: string;
  hint?: string;
}

interface UiState {
  view: View;
  toasts: Toast[];
  wordPopover: { word: string; lineIdx: number } | null;
}

const [ui, setUi] = createStore<UiState>({
  view: 'stage',
  toasts: [],
  wordPopover: null,
});

export { ui };

export function setView(view: View): void {
  setUi('view', view);
}

let nextId = 1;

export function toast(message: string, hint?: string): void {
  const id = nextId++;
  setUi('toasts', (list) => [...list, { id, message, ...(hint ? { hint } : {}) }]);
  setTimeout(() => dismissToast(id), 5000);
}

export function dismissToast(id: number): void {
  setUi('toasts', (list) => list.filter((entry) => entry.id !== id));
}

export function openWord(word: string, lineIdx: number): void {
  setUi('wordPopover', { word, lineIdx });
}

export function closeWord(): void {
  setUi('wordPopover', null);
}
