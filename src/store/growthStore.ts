import { create } from 'zustand';
import { GROWTH_PRESETS } from '../data/growthPresets';
import type { GrowthData, GrowthOutcome, GrowthPractice, SavedExercise } from '../types';
import { emptyGrowth, growthExercises, validateGrowth } from '../utils/growth';
import { normalizedName } from '../utils/knowledge';
import { generateId, getTodayDate, STORAGE_KEYS } from '../utils/storage';

type OutcomeDetails = Omit<GrowthOutcome, 'practices'>;

interface GrowthStore extends GrowthData {
  isLoaded: boolean;
  error: string;
  loadGrowth: () => void;
  savePractice: (outcome: OutcomeDetails, practice: GrowthPractice, groupId?: string) => void;
  removePractice: (outcomeId: string, practiceId: string) => void;
  saveExercise: (exercise: SavedExercise) => void;
  editExercise: (exercise: SavedExercise, groupId?: string) => void;
  removeExercise: (id: string) => void;
  restorePreset: (id: string) => void;
  saveGroup: (name: string, id?: string) => string;
  removeGroup: (id: string) => void;
  moveCard: (cardId: string, groupId: string | null) => void;
}

export const useGrowthStore = create<GrowthStore>((set, get) => {
  const persist = (change: Partial<GrowthData>) => {
    const { isLoaded, error, outcomes, exercises, hiddenPresetIds, groups } = get();
    if (!isLoaded || error) throw new Error(error || '成长记录正在加载。');
    const data = validateGrowth({ version: 1, outcomes, exercises, hiddenPresetIds, groups, ...change });
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
    savePractice: (outcome, practice, groupId) => {
      if (practice.date > getTodayDate()) throw new Error('实践日期不能晚于今天。');
      const { outcomes, groups } = get();
      const existing = outcomes.find((item) => item.id === outcome.id);
      const previous = existing?.practices ?? [];
      const practices = previous.some((item) => item.id === practice.id)
        ? previous.map((item) => item.id === practice.id ? practice : item)
        : [...previous, practice];
      const next = { ...existing, ...outcome, practices };
      persist({ outcomes: existing ? outcomes.map((item) => item.id === outcome.id ? next : item) : [...outcomes, next],
        groups: groupId && !existing ? groups.map((group) => group.id === groupId
          ? { ...group, cardIds: [...new Set([...group.cardIds, outcome.id])] } : group) : groups });
    },
    removePractice: (outcomeId, practiceId) => {
      const { outcomes, exercises, groups } = get();
      const remaining = outcomes.map((outcome) => outcome.id === outcomeId
        ? { ...outcome, practices: outcome.practices.filter((practice) => practice.id !== practiceId) }
        : outcome).filter((outcome) => outcome.practices.length > 0);
      const stillExists = [...remaining, ...exercises, ...GROWTH_PRESETS].some(({ id }) => id === outcomeId);
      persist({ outcomes: remaining, groups: stillExists ? groups : groups.map((group) => ({
        ...group, cardIds: group.cardIds.filter((id) => id !== outcomeId),
      })) });
    },
    saveExercise: (exercise) => {
      const data = get();
      const existing = [...data.outcomes, ...growthExercises(data)].find(({ id, title }) =>
        id === exercise.id || normalizedName(title) === normalizedName(exercise.title));
      if (existing) return;
      persist({ exercises: [...data.exercises, exercise] });
    },
    editExercise: (exercise, groupId) => {
      const { exercises, outcomes, groups, hiddenPresetIds } = get();
      if (outcomes.some(({ id }) => id === exercise.id) || hiddenPresetIds.includes(exercise.id)) {
        throw new Error('这张卡片已离开「待尝试」。');
      }
      const title = normalizedName(exercise.title);
      if (!title) throw new Error('请输入卡片名称。');
      const overriddenIds = new Set(exercises.map(({ id }) => id));
      const cards = [...outcomes, ...exercises, ...GROWTH_PRESETS.filter(({ id }) => !overriddenIds.has(id))];
      if (cards.some((card) => card.id !== exercise.id && normalizedName(card.title) === title)) {
        throw new Error('已有同名卡片。');
      }
      persist({
        exercises: exercises.some(({ id }) => id === exercise.id)
          ? exercises.map((item) => item.id === exercise.id ? exercise : item) : [...exercises, exercise],
        groups: groupId ? groups.map((group) => group.id === groupId
          ? { ...group, cardIds: [...new Set([...group.cardIds, exercise.id])] } : group) : groups,
      });
    },
    removeExercise: (id) => {
      const { exercises, groups, outcomes, hiddenPresetIds } = get();
      if (outcomes.some((outcome) => outcome.id === id)) return;
      if (GROWTH_PRESETS.some((preset) => preset.id === id)) {
        if (!hiddenPresetIds.includes(id)) persist({ hiddenPresetIds: [...hiddenPresetIds, id] });
        return;
      }
      persist({ exercises: exercises.filter((exercise) => exercise.id !== id),
        groups: groups.map((group) => ({
          ...group, cardIds: group.cardIds.filter((cardId) => cardId !== id),
        })),
      });
    },
    restorePreset: (id) => persist({ hiddenPresetIds: get().hiddenPresetIds.filter((hiddenId) => hiddenId !== id) }),
    saveGroup: (name, id) => {
      const { groups } = get();
      const value = name.trim();
      if (!value) throw new Error('请输入卡组名称。');
      if (groups.some((group) => group.id !== id && normalizedName(group.name) === normalizedName(value))) {
        throw new Error('已有同名卡组。');
      }
      const groupId = id ?? generateId();
      if (id && !groups.some((group) => group.id === id)) throw new Error('找不到这个卡组。');
      persist({ groups: id ? groups.map((group) => group.id === id ? { ...group, name: value } : group)
        : [...groups, { id: groupId, name: value, cardIds: [] }] });
      return groupId;
    },
    removeGroup: (id) => persist({ groups: get().groups.filter((group) => group.id !== id) }),
    moveCard: (cardId, groupId) => {
      const { groups } = get();
      if (groupId && !groups.some(({ id }) => id === groupId)) throw new Error('找不到目标卡组。');
      persist({ groups: groups.map((group) => ({
        ...group,
        cardIds: group.id === groupId ? [...group.cardIds.filter((id) => id !== cardId), cardId] : group.cardIds.filter((id) => id !== cardId),
      })) });
    },
  };
});
