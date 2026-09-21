import { create } from 'zustand';
import type { LearningTask } from '../types';
import { generateId, getStorageItem, setStorageItem, STORAGE_KEYS } from '../utils/storage';

interface TaskStore {
  tasks: LearningTask[];
  isLoaded: boolean;
  loadTasks: () => void;
  addTask: (parentSkillId: string, title: string, description: string) => void;
  updateTask: (id: string, title: string, description: string) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  isLoaded: false,

  loadTasks: () => {
    const tasks = getStorageItem<LearningTask[]>(STORAGE_KEYS.TASKS, []);
    set({ tasks, isLoaded: true });
  },

  addTask: (parentSkillId, title, description) => {
    const now = Date.now();
    const task: LearningTask = {
      id: generateId(),
      parentSkillId,
      title,
      description,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };
    const tasks = [...get().tasks, task];
    set({ tasks });
    setStorageItem(STORAGE_KEYS.TASKS, tasks);
  },

  updateTask: (id, title, description) => {
    const tasks = get().tasks.map((task) => task.id === id
      ? { ...task, title, description, updatedAt: Date.now() }
      : task);
    set({ tasks });
    setStorageItem(STORAGE_KEYS.TASKS, tasks);
  },

  toggleTask: (id) => {
    const tasks = get().tasks.map((task) => task.id === id
      ? { ...task, completed: !task.completed, updatedAt: Date.now() }
      : task);
    set({ tasks });
    setStorageItem(STORAGE_KEYS.TASKS, tasks);
  },

  deleteTask: (id) => {
    const tasks = get().tasks.filter((task) => task.id !== id);
    set({ tasks });
    setStorageItem(STORAGE_KEYS.TASKS, tasks);
  },
}));
