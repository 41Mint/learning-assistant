import { create } from 'zustand';
import { GROWTH_PRESETS } from '../data/growthPresets';
import type { GrowthData, GrowthGroup, GrowthOutcome, GrowthPractice, SavedExercise } from '../types';
import { emptyGrowth, growthExercises, validateGrowth } from '../utils/growth';
import { normalizedName } from '../utils/knowledge';
import { generateId, getTodayDate, STORAGE_KEYS } from '../utils/storage';
import type { HistoryDirection } from '../utils/workspaceHistory';

type OutcomeDetails = Omit<GrowthOutcome, 'practices'>;
type Arrangement = Pick<GrowthData, 'groups' | 'exercises' | 'hiddenPresetIds'>;
type ArrangementHistory = Record<HistoryDirection, Arrangement[]>;

interface GrowthStore extends GrowthData {
  isLoaded: boolean;
  error: string;
  arrangementHistory: ArrangementHistory;
  loadGrowth: () => void;
  savePractice: (outcome: OutcomeDetails, practice: GrowthPractice, groupId?: string, exercise?: SavedExercise) => void;
  removePractice: (outcomeId: string, practiceId: string) => void;
  saveExercise: (exercise: SavedExercise, groupId?: string) => boolean;
  editExercise: (exercise: SavedExercise, groupId?: string) => void;
  removeExercises: (ids: string[]) => void;
  restorePreset: (id: string) => void;
  saveGroup: (name: string, id?: string, cardIds?: string[], exercise?: SavedExercise) => string;
  removeGroup: (id: string) => void;
  moveCards: (cardIds: string[], groupId: string | null) => void;
  applyGrouping: (name: string, cardIds: string[]) => void;
  applyArrangementHistory: (direction: HistoryDirection) => boolean;
}

function placeCards(groups: GrowthGroup[], cardIds: string[], groupId?: string | null) {
  if (groupId && !groups.some(({ id }) => id === groupId)) throw new Error('找不到目标卡组。');
  const moving = new Set(cardIds);
  return groups.map((group) => {
    const next = group.id === groupId ? [...new Set([...group.cardIds, ...cardIds])] : group.cardIds.filter((id) => !moving.has(id));
    return next.length === group.cardIds.length ? group : { ...group, cardIds: next };
  });
}

export const useGrowthStore = create<GrowthStore>((set, get) => {
  const persist = (change: Partial<GrowthData>, arrangementHistory: ArrangementHistory = { undo: [], redo: [] }) => {
    const { isLoaded, error, outcomes, exercises, hiddenPresetIds, groups } = get();
    if (!isLoaded || error) throw new Error(error || '成长记录正在加载。');
    const data = validateGrowth({ version: 1, outcomes, exercises, hiddenPresetIds, groups, ...change });
    localStorage.setItem(STORAGE_KEYS.GROWTH, JSON.stringify(data));
    set({ ...data, arrangementHistory });
  };
  const snapshot = ({ groups, exercises, hiddenPresetIds }: Arrangement): Arrangement => ({ groups, exercises, hiddenPresetIds });
  const arrange = (change: Partial<Arrangement>) => {
    const current = get();
    persist(change, { undo: [...current.arrangementHistory.undo.slice(-49), snapshot(current)], redo: [] });
  };

  return {
    ...emptyGrowth(),
    isLoaded: false,
    error: '',
    arrangementHistory: { undo: [], redo: [] },
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
    savePractice: (outcome, practice, groupId, exercise) => {
      if (practice.date > getTodayDate()) throw new Error('实践日期不能晚于今天。');
      const { outcomes, groups, exercises } = get();
      const existing = outcomes.find((item) => item.id === outcome.id);
      const previous = existing?.practices ?? [];
      const practices = previous.some((item) => item.id === practice.id)
        ? previous.map((item) => item.id === practice.id ? practice : item)
        : [...previous, practice];
      const next = { ...existing, ...outcome, practices };
      persist({ outcomes: existing ? outcomes.map((item) => item.id === outcome.id ? next : item) : [...outcomes, next],
        exercises: exercise && !exercises.some(({ id }) => id === exercise.id) ? [...exercises, exercise] : exercises,
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
    saveExercise: (exercise, groupId) => {
      const data = get();
      const existing = [...data.outcomes, ...growthExercises(data)].find(({ id, title }) =>
        id === exercise.id || normalizedName(title) === normalizedName(exercise.title));
      if (existing) return false;
      arrange({ exercises: [...data.exercises, exercise],
        groups: groupId ? placeCards(data.groups, [exercise.id], groupId) : data.groups });
      return true;
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
    removeExercises: (ids) => {
      const data = get();
      const completed = new Set(data.outcomes.map(({ id }) => id));
      const requested = new Set(ids);
      const pending = growthExercises(data).filter(({ id }) => requested.has(id) && !completed.has(id));
      if (!pending.length) return;
      const presetIds = new Set(GROWTH_PRESETS.map(({ id }) => id));
      const customIds = pending.map(({ id }) => id).filter((id) => !presetIds.has(id));
      arrange({
        exercises: data.exercises.filter(({ id }) => !customIds.includes(id)),
        groups: placeCards(data.groups, customIds, null),
        hiddenPresetIds: [...data.hiddenPresetIds, ...pending.map(({ id }) => id).filter((id) => presetIds.has(id))],
      });
    },
    restorePreset: (id) => {
      const { hiddenPresetIds } = get();
      if (hiddenPresetIds.includes(id)) arrange({ hiddenPresetIds: hiddenPresetIds.filter((hiddenId) => hiddenId !== id) });
    },
    saveGroup: (name, id, cardIds = [], exercise) => {
      const data = get();
      const { groups } = data;
      const value = name.trim();
      if (!value) throw new Error('请输入卡组名称。');
      if (groups.some((group) => group.id !== id && normalizedName(group.name) === normalizedName(value))) {
        throw new Error('已有同名卡组。');
      }
      const groupId = id ?? generateId();
      if (id && !groups.some((group) => group.id === id)) throw new Error('找不到这个卡组。');
      const next = id ? groups.map((group) => group.id === id ? { ...group, name: value } : group)
        : [...groups, { id: groupId, name: value, cardIds: [] }];
      if (exercise && [...data.outcomes, ...growthExercises(data)].some((card) =>
        card.id === exercise.id || normalizedName(card.title) === normalizedName(exercise.title))) throw new Error('已有同名卡片。');
      arrange({ groups: cardIds.length ? placeCards(next, cardIds, groupId) : next,
        exercises: exercise ? [...data.exercises, exercise] : data.exercises });
      return groupId;
    },
    removeGroup: (id) => arrange({ groups: get().groups.filter((group) => group.id !== id) }),
    moveCards: (cardIds, groupId) => {
      const { groups } = get();
      const next = placeCards(groups, cardIds, groupId);
      if (next.some((group, index) => group !== groups[index])) arrange({ groups: next });
    },
    applyGrouping: (name, cardIds) => {
      const current = get();
      if (!current.isLoaded || current.error) throw new Error(current.error || '成长记录正在加载。');
      const { version, outcomes, exercises, groups, hiddenPresetIds } = current;
      const raw = localStorage.getItem(STORAGE_KEYS.GROWTH);
      const stored = raw === null ? emptyGrowth() : validateGrowth(JSON.parse(raw));
      if (JSON.stringify(stored) !== JSON.stringify({ version, outcomes, exercises, hiddenPresetIds, groups })) {
        throw new Error('成长记录已经在其他页面更新。请刷新后重新获取分组建议。');
      }
      const available = new Set([...outcomes, ...growthExercises(current)].map(({ id }) => id));
      if (cardIds.length < 2 || new Set(cardIds).size !== cardIds.length || cardIds.some((id) => !available.has(id))) {
        throw new Error('这组建议包含已不可用的卡片，请重新选卡。');
      }
      const existing = groups.find((group) => normalizedName(group.name) === normalizedName(name));
      if (existing && cardIds.every((id) => existing.cardIds.includes(id))) return;
      current.saveGroup(existing?.name ?? name, existing?.id, cardIds);
    },
    applyArrangementHistory: (direction) => {
      const current = get();
      const { arrangementHistory } = current;
      const previous = arrangementHistory[direction].at(-1);
      if (!previous) return false;
      const other = direction === 'undo' ? 'redo' : 'undo';
      persist(previous, {
        ...arrangementHistory,
        [direction]: arrangementHistory[direction].slice(0, -1),
        [other]: [...arrangementHistory[other], snapshot(current)],
      });
      return true;
    },
  };
});
