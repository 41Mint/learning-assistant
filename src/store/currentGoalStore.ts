import { create } from 'zustand';
import { getSkillNode } from '../data/skillPath';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../utils/storage';

export interface CurrentGoal {
  type: 'skill' | 'task';
  id: string;
  label: string;
}

interface CurrentGoalStorageV1 {
  version: 1;
  skillId: string | null;
}

interface CurrentGoalStorageV2 {
  version: 2;
  goal: CurrentGoal | null;
}

interface CurrentGoalStore {
  goal: CurrentGoal | null;
  isLoaded: boolean;
  loadCurrentGoal: () => void;
  setCurrentGoal: (goal: CurrentGoal) => void;
  clearCurrentGoal: () => void;
}

const INITIAL_STATE: CurrentGoalStorageV2 = { version: 2, goal: null };

function persist(goal: CurrentGoal | null) {
  setStorageItem<CurrentGoalStorageV2>(STORAGE_KEYS.CURRENT_GOAL, { version: 2, goal });
}

function readGoal(): CurrentGoal | null {
  const stored = getStorageItem<CurrentGoalStorageV1 | CurrentGoalStorageV2>(STORAGE_KEYS.CURRENT_GOAL, INITIAL_STATE);
  if (stored.version === 2) return stored.goal;

  const skill = stored.skillId ? getSkillNode(stored.skillId) : undefined;
  return skill ? { type: 'skill', id: skill.id, label: skill.name } : null;
}

export const useCurrentGoalStore = create<CurrentGoalStore>((set) => ({
  goal: null,
  isLoaded: false,

  loadCurrentGoal: () => {
    const goal = readGoal();
    set({ goal, isLoaded: true });
    persist(goal);
  },

  setCurrentGoal: (goal) => {
    set({ goal, isLoaded: true });
    persist(goal);
  },

  clearCurrentGoal: () => {
    set({ goal: null, isLoaded: true });
    persist(null);
  },
}));
