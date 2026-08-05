import { create } from 'zustand';
import type { Clip, SavedLine, SavedWord } from '@lyrika/shared';
import { api } from '../api';
import { useUi } from './ui';

interface LibraryState {
  words: SavedWord[];
  lines: SavedLine[];
  feed: Clip[];
  loaded: boolean;

  load: () => Promise<void>;
  saveWord: (payload: Omit<SavedWord, 'id' | 'savedAt' | 'seenCount'>) => Promise<void>;
  removeWord: (id: string) => Promise<void>;
  saveLine: (payload: Omit<SavedLine, 'id' | 'savedAt'>) => Promise<void>;
  removeLine: (id: string) => Promise<void>;
  publishClip: (payload: Omit<Clip, 'id' | 'author' | 'likes' | 'createdAt'>) => Promise<void>;
  exportCsv: () => void;
}

function toCsv(words: SavedWord[]): string {
  const rows = [
    ['word', 'translit', 'gloss', 'track', 'at_sec', 'seen'],
    ...words.map((w) => [
      w.word,
      w.translit,
      w.gloss,
      w.trackTitle,
      w.atSec.toFixed(1),
      String(w.seenCount),
    ]),
  ];
  return rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export const useLibrary = create<LibraryState>()((set, get) => ({
  words: [],
  lines: [],
  feed: [],
  loaded: false,

  load: async () => {
    try {
      const [vocab, feed] = await Promise.all([api.vocabulary(), api.feed()]);
      set({ words: vocab.words, lines: vocab.lines, feed: feed.clips, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  saveWord: async (payload) => {
    const { toast } = useUi.getState();
    try {
      const { words } = await api.saveWord(payload);
      set({ words });
      toast(`«${payload.word}» в словаре`, 'success');
    } catch {
      toast('Не удалось сохранить слово', 'error');
    }
  },

  removeWord: async (id) => {
    try {
      const { words } = await api.deleteWord(id);
      set({ words });
    } catch {
      useUi.getState().toast('Не удалось удалить', 'error');
    }
  },

  saveLine: async (payload) => {
    const { toast } = useUi.getState();
    try {
      const { lines } = await api.saveLine(payload);
      set({ lines });
      toast('Строка сохранена', 'success');
    } catch {
      toast('Не удалось сохранить строку', 'error');
    }
  },

  removeLine: async (id) => {
    try {
      const { lines } = await api.deleteLine(id);
      set({ lines });
    } catch {
      useUi.getState().toast('Не удалось удалить', 'error');
    }
  },

  publishClip: async (payload) => {
    const { toast } = useUi.getState();
    try {
      const { clips } = await api.publishClip(payload);
      const feed = await api.feed().catch(() => null);
      set({ feed: feed?.clips ?? clips });
      toast('Клип опубликован в ленту', 'success');
    } catch {
      toast('Не удалось опубликовать клип', 'error');
    }
  },

  exportCsv: () => {
    const csv = toCsv(get().words);
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lyrika-vocabulary.csv';
    link.click();
    URL.revokeObjectURL(url);
  },
}));
