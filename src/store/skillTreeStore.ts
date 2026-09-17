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
  isUnlocked: (id: string) => boolean;
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

  isUnlocked: (id: string) => {
    const node = getSkillNode(id);
    return Boolean(node && node.prerequisites.every((prerequisite) => get().completedIds.includes(prerequisite)));
  },

  toggleCompleted: (id: string) => {
    const node = getSkillNode(id);
    if (!node) {
      return { changed: false, reason: '未找到这个学习节点。' };
    }

    const completedIds = get().completedIds;
    if (!completedIds.includes(id)) {
      if (!get().isUnlocked(id)) {
        return { changed: false, reason: '请先完成该节点的前置学习内容。' };
      }

      const nextCompletedIds = [...completedIds, id];
      set({ completedIds: nextCompletedIds });
      persist(nextCompletedIds);
      return { changed: true };
    }

    const completedDependents = SKILL_PATH.filter(
      (candidate) => candidate.prerequisites.includes(id) && completedIds.includes(candidate.id),
    );
    if (completedDependents.length > 0) {
      return {
        changed: false,
        reason: `请先撤销后续节点“${completedDependents[0].name}”的完成状态。`,
      };
    }

    const nextCompletedIds = completedIds.filter((completedId) => completedId !== id);
    set({ completedIds: nextCompletedIds });
    persist(nextCompletedIds);
    return { changed: true };
  },
}));
