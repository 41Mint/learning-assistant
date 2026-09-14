import { create } from 'zustand';
import { PomodoroState } from '../types';

interface PomodoroStore extends PomodoroState {
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  switchMode: () => void;
  tick: () => void;
  setStudyDuration: (duration: number) => void;
  setBreakDuration: (duration: number) => void;
  completePomodoro: () => void;
}

const DEFAULT_STUDY_DURATION = 25 * 60; // 25分钟
const DEFAULT_BREAK_DURATION = 5 * 60; // 5分钟

export const usePomodoroStore = create<PomodoroStore>((set, get) => ({
  isRunning: false,
  timeLeft: DEFAULT_STUDY_DURATION,
  mode: 'study',
  studyDuration: DEFAULT_STUDY_DURATION,
  breakDuration: DEFAULT_BREAK_DURATION,
  completedPomodoros: 0,

  startTimer: () => set({ isRunning: true }),

  pauseTimer: () => set({ isRunning: false }),

  resetTimer: () => {
    const { mode, studyDuration, breakDuration } = get();
    set({
      isRunning: false,
      timeLeft: mode === 'study' ? studyDuration : breakDuration,
    });
  },

  switchMode: () => {
    const { mode, studyDuration, breakDuration } = get();
    const newMode = mode === 'study' ? 'break' : 'study';
    set({
      mode: newMode,
      timeLeft: newMode === 'study' ? studyDuration : breakDuration,
      isRunning: false,
    });
  },

  tick: () => {
    const { timeLeft, isRunning, mode } = get();
    if (!isRunning) return;

    if (timeLeft > 0) {
      set({ timeLeft: timeLeft - 1 });
    } else {
      // 时间到了
      if (mode === 'study') {
        get().completePomodoro();
      }
      // 自动切换模式
      get().switchMode();
      // 可以在这里添加通知或音效
    }
  },

  setStudyDuration: (duration: number) => {
    set({ studyDuration: duration * 60 });
    if (get().mode === 'study' && !get().isRunning) {
      set({ timeLeft: duration * 60 });
    }
  },

  setBreakDuration: (duration: number) => {
    set({ breakDuration: duration * 60 });
    if (get().mode === 'break' && !get().isRunning) {
      set({ timeLeft: duration * 60 });
    }
  },

  completePomodoro: () => {
    set((state) => ({
      completedPomodoros: state.completedPomodoros + 1,
    }));
  },
}));
