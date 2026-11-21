import { create } from 'zustand';
import type { LearningTask } from '../types';
import { generateId, getStorageItem, setStorageItem, STORAGE_KEYS, writeStorageItems } from '../utils/storage';
import { readCurrentGoal, useCurrentGoalStore } from './currentGoalStore';
import { logsWithTaskLinks, logsWithoutTaskLinks } from '../utils/studyLogs';
import { readSkillTree } from '../utils/skillPathStorage';
import { useStudyLogStore } from './studyLogStore';

export type TaskDraft = Pick<LearningTask, 'parentSkillId' | 'title' | 'description'>;

interface TaskStore {
  tasks: LearningTask[];
  isLoaded: boolean;
  loadTasks: () => void;
  addTask: (parentSkillId: string, title: string, description: string) => void;
  addTaskToLog: (draft: TaskDraft, logId: string, taskIds: readonly string[], previousIds: readonly string[]) => void;
  updateTask: (id: string, title: string, description: string) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
}

function makeTask(draft: TaskDraft): LearningTask {
  const now = Date.now();
  return { ...draft, id: generateId(), completed: false, createdAt: now, updatedAt: now };
}

function checkedTasks({ tasks, isLoaded }: TaskStore): LearningTask[] {
  if (!isLoaded) throw new Error('任务正在加载。');
  const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) ?? '[]');
  if (JSON.stringify(stored) !== JSON.stringify(tasks)) throw new Error('任务已在其他页面更新，请刷新后重试。');
  return tasks;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  isLoaded: false,

  loadTasks: () => {
    const tasks = getStorageItem<LearningTask[]>(STORAGE_KEYS.TASKS, []);
    set({ tasks, isLoaded: true });
  },

  addTask: (parentSkillId, title, description) => {
    const tasks = [...checkedTasks(get()), makeTask({ parentSkillId, title, description })];
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    set({ tasks });
  },

  addTaskToLog: (draft, logId, taskIds, previousIds) => {
    const current = checkedTasks(get());
    if (!readSkillTree().topics.some(({ id }) => id === draft.parentSkillId)) throw new Error('所选主题已不可用，请重新选择。');
    const title = draft.title.trim();
    if (!title) throw new Error('请填写任务名称。');
    const task = makeTask({ ...draft, title, description: draft.description.trim() });
    const tasks = [...current, task];
    const logs = logsWithTaskLinks(logId, [...taskIds, task.id], previousIds, new Set(tasks.map(({ id }) => id)));
    if (!logs) return;
    try {
      writeStorageItems([[STORAGE_KEYS.TASKS, tasks], [STORAGE_KEYS.STUDY_LOGS, logs]]);
    } catch {
      throw new Error('保存任务和关联失败，请重试。');
    }
    set({ tasks });
    useStudyLogStore.getState().loadLogs();
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
    const current = get();
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) ?? '[]');
    if (!current.isLoaded || JSON.stringify(stored) !== JSON.stringify(current.tasks)) {
      throw new Error('任务已在其他页面更新，请刷新后重试。');
    }
    const tasks = current.tasks.filter((task) => task.id !== id);
    const goal = readCurrentGoal();
    const clearGoal = goal?.type === 'task' && goal.id === id;
    const writes: [string, unknown][] = [[STORAGE_KEYS.TASKS, tasks]];
    const logs = logsWithoutTaskLinks(new Set([id]));
    if (logs) writes.push([STORAGE_KEYS.STUDY_LOGS, logs]);
    if (clearGoal) writes.push([STORAGE_KEYS.CURRENT_GOAL, { version: 2, goal: null }]);
    try {
      writeStorageItems(writes);
    } catch {
      throw new Error('删除任务失败，请重试。');
    }
    set({ tasks });
    if (logs) useStudyLogStore.getState().loadLogs();
    if (clearGoal) useCurrentGoalStore.setState({ goal: null, isLoaded: true });
  },
}));
