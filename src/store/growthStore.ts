import { create } from 'zustand';
import type { GrowthData, GrowthOutcome, GrowthPractice } from '../types';
import { emptyGrowth, validateGrowth } from '../utils/growth';
import { getTodayDate, STORAGE_KEYS } from '../utils/storage';

type OutcomeDetails = Omit<GrowthOutcome, 'practices'>;

interface GrowthStore extends GrowthData {
  isLoaded: boolean;
  error: string;
  loadGrowth: () => void;
  savePractice: (outcome: OutcomeDetails, practice: GrowthPractice) => void;
  removePractice: (outcomeId: string, practiceId: string) => void;
}

export const useGrowthStore = create<GrowthStore>((set, get) => {
  const persist = (outcomes: GrowthOutcome[]) => {
    const { isLoaded, error } = get();
    if (!isLoaded || error) throw new Error(error || '成长记录正在加载。');
    const data = validateGrowth({ version: 1, outcomes });
    localStorage.setItem(STORAGE_KEYS.GROWTH, JSON.stringify(data));
    set(data);
  };

  return {
    ...emptyGrowth(),
    isLoaded: false,
    error: '',
    loadGrowth: () => {
      if (get().isLoaded) return;
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.GROWTH);
        const data = raw === null ? emptyGrowth() : validateGrowth(JSON.parse(raw));
        set({ ...data, isLoaded: true });
      } catch {
        set({ isLoaded: true, error: '成长记录读取失败，已保留浏览器中的原始数据。' });
      }
    },
    savePractice: (outcome, practice) => {
      if (practice.date > getTodayDate()) throw new Error('实践日期不能晚于今天。');
      const outcomes = get().outcomes;
      const existing = outcomes.find((item) => item.id === outcome.id);
      const previous = existing?.practices ?? [];
      const practices = previous.some((item) => item.id === practice.id)
        ? previous.map((item) => item.id === practice.id ? practice : item)
        : [...previous, practice];
      const next = { ...outcome, practices };
      persist(existing ? outcomes.map((item) => item.id === outcome.id ? next : item) : [...outcomes, next]);
    },
    removePractice: (outcomeId, practiceId) => {
      const outcomes = get().outcomes.map((outcome) => outcome.id === outcomeId
        ? { ...outcome, practices: outcome.practices.filter((practice) => practice.id !== practiceId) }
        : outcome);
      persist(outcomes.filter((outcome) => outcome.practices.length > 0));
    },
  };
});
