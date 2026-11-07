import { create } from 'zustand';
import { SKILL_PATH, getSkillNode } from '../data/skillPath';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../utils/storage';

interface SkillTreeStorage {
  version: 1;
  completedIds: string[];
}

interface ToggleResult {
  changed: boolean;
  reason?: string;
}

interface SkillTreeStore {
  completedIds: string[];
  isLoaded: boolean;
  loadSkillTree: () => void;
  toggleCompleted: (id: string) => ToggleResult;
}

const INITIAL_STORAGE: SkillTreeStorage = {
  version: 1,
  completedIds: [],
};

function persist(completedIds: string[]) {
  setStorageItem<SkillTreeStorage>(STORAGE_KEYS.SKILL_TREE, {
    version: 1,
    completedIds,
  });
}

export const useSkillTreeStore = create<SkillTreeStore>((set, get) => ({
  completedIds: [],
  isLoaded: false,

  loadSkillTree: () => {
    const stored = getStorageItem<SkillTreeStorage>(STORAGE_KEYS.SKILL_TREE, INITIAL_STORAGE);
    const validIds = new Set(SKILL_PATH.map((node) => node.id));
    const completedIds = [...new Set(stored.completedIds)].filter((id) => validIds.has(id));
    set({ completedIds, isLoaded: true });
  },

  toggleCompleted: (id: string) => {
    const node = getSkillNode(id);
    if (!node) {
      return { changed: false, reason: '未找到这个学习节点。' };
    }

    const completedIds = get().completedIds;
    const nextCompletedIds = completedIds.includes(id)
      ? completedIds.filter((completedId) => completedId !== id)
      : [...completedIds, id];
    persist(nextCompletedIds);
    set({ completedIds: nextCompletedIds });
    return { changed: true };
  },
}));
