import { create } from 'zustand';
import { readSkillTree } from '../utils/skillPathStorage';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../utils/storage';

export interface CurrentGoal {
  type: 'skill' | 'task' | 'practice' | 'growth-card';
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

export function readCurrentGoal(): CurrentGoal | null {
  const stored = getStorageItem<CurrentGoalStorageV1 | CurrentGoalStorageV2>(STORAGE_KEYS.CURRENT_GOAL, INITIAL_STATE);
  if (stored.version === 2) return stored.goal;

  if (!stored.skillId) return null;
  try {
    const skill = readSkillTree().topics.find(({ id }) => id === stored.skillId);
    return skill ? { type: 'skill', id: skill.id, label: skill.name } : null;
  } catch {
    return null;
  }
}

export const useCurrentGoalStore = create<CurrentGoalStore>((set) => ({
  goal: null,
  isLoaded: false,

  loadCurrentGoal: () => {
    const goal = readCurrentGoal();
    set({ goal, isLoaded: true });
    persist(goal);
  },

  setCurrentGoal: (goal) => {
    if (goal.type === 'practice' || goal.type === 'growth-card') localStorage.setItem(STORAGE_KEYS.CURRENT_GOAL, JSON.stringify({ version: 2, goal } satisfies CurrentGoalStorageV2));
    else persist(goal);
    set({ goal, isLoaded: true });
  },

  clearCurrentGoal: () => {
    set({ goal: null, isLoaded: true });
    persist(null);
  },
}));
