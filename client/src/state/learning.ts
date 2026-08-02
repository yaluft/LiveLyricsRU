import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LearningMode =
  | 'off'
  | 'karaoke'
  | 'shadowing'
  | 'heatmap'
  | 'pulse';

interface StreakState {
  days: number;
  lastDay: string;
  goalMinutes: number;
  listenedTodaySec: number;
}

interface LearningState extends StreakState {
  mode: LearningMode;
  bookmarkLineId: string | null;
  quizOpen: boolean;
  compareOpen: boolean;
  suggestionsOpen: boolean;

  setMode: (mode: LearningMode) => void;
  toggleMode: (mode: Exclude<LearningMode, 'off'>) => void;
  setBookmark: (lineId: string | null) => void;
  setQuizOpen: (open: boolean) => void;
  setCompareOpen: (open: boolean) => void;
  setSuggestionsOpen: (open: boolean) => void;
  tickListening: (deltaSec: number) => void;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function bumpStreak(lastDay: string, days: number): { days: number; lastDay: string } {
  const today = todayKey();
  if (lastDay === today) return { days, lastDay };
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const nextDays = lastDay === yesterday ? days + 1 : 1;
  return { days: nextDays, lastDay: today };
}

export const useLearning = create<LearningState>()(
  persist(
    (set, get) => ({
      mode: 'off',
      bookmarkLineId: null,
      quizOpen: false,
      compareOpen: false,
      suggestionsOpen: false,
      days: 0,
      lastDay: '',
      goalMinutes: 15,
      listenedTodaySec: 0,

      setMode: (mode) => set({ mode }),
      toggleMode: (mode) => set((s) => ({ mode: s.mode === mode ? 'off' : mode })),

      setBookmark: (lineId) => set({ bookmarkLineId: lineId }),

      setQuizOpen: (open) => set({ quizOpen: open }),
      setCompareOpen: (open) => set({ compareOpen: open }),
      setSuggestionsOpen: (open) => set({ suggestionsOpen: open }),

      tickListening: (deltaSec) => {
        if (deltaSec <= 0) return;
        const state = get();
        const today = todayKey();
        const streak =
          state.lastDay === today
            ? { days: state.days, lastDay: state.lastDay }
            : bumpStreak(state.lastDay, state.days);
        const listenedTodaySec =
          streak.lastDay === today && state.lastDay === today
            ? state.listenedTodaySec + deltaSec
            : deltaSec;
        set({ ...streak, listenedTodaySec });
      },
    }),
    { name: 'lyrika.learning', version: 1 },
  ),
);
