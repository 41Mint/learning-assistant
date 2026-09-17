import { create } from 'zustand';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../utils/storage';

interface CurrentGoalStorage {
  version: 1;
  skillId: string | null;
}

interface CurrentGoalStore {
  skillId: string | null;
  isLoaded: boolean;
  loadCurrentGoal: () => void;
  setCurrentGoal: (skillId: string) => void;
  clearCurrentGoal: () => void;
}

const INITIAL_STATE: CurrentGoalStorage = { version: 1, skillId: null };

function persist(skillId: string | null) {
  setStorageItem<CurrentGoalStorage>(STORAGE_KEYS.CURRENT_GOAL, { version: 1, skillId });
}

export const useCurrentGoalStore = create<CurrentGoalStore>((set) => ({
  skillId: null,
  isLoaded: false,

  loadCurrentGoal: () => {
    const { skillId } = getStorageItem<CurrentGoalStorage>(STORAGE_KEYS.CURRENT_GOAL, INITIAL_STATE);
    set({ skillId, isLoaded: true });
  },

  setCurrentGoal: (skillId) => {
    set({ skillId, isLoaded: true });
    persist(skillId);
  },

  clearCurrentGoal: () => {
    set({ skillId: null, isLoaded: true });
    persist(null);
  },
}));
