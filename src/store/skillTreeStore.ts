import { create } from 'zustand';
import { SKILL_PATH } from '../data/skillPath';
import type { SkillNodeDefinition } from '../data/skillPath';
import type { LearningTask } from '../types';
import { generateId, STORAGE_KEYS, writeStorageItems } from '../utils/storage';
import { readSkillTree, validateSkillTree } from '../utils/skillPathStorage';
import type { SkillTreeStorage } from '../utils/skillPathStorage';
import { readCurrentGoal, useCurrentGoalStore } from './currentGoalStore';
import type { CurrentGoal } from './currentGoalStore';
import { useTaskStore } from './taskStore';
import { useStudyLogStore } from './studyLogStore';
import { logsWithoutTaskLinks } from '../utils/studyLogs';
import type { StoredStudyLog } from '../utils/studyLogs';

export type TopicFields = Pick<SkillNodeDefinition, 'name' | 'description' | 'category' | 'prerequisites'>;

interface SkillTreeStore {
  topics: SkillNodeDefinition[];
  completedIds: string[];
  isLoaded: boolean;
  error: string;
  loadSkillTree: () => void;
  saveTopic: (fields: TopicFields, id?: string) => string;
  deleteTopic: (id: string) => void;
  toggleCompleted: (id: string) => void;
}

function writeChanges(tree: SkillTreeStorage, goal?: CurrentGoal | null, tasks?: LearningTask[], logs?: StoredStudyLog[]) {
  const pairs: [string, unknown][] = [[STORAGE_KEYS.SKILL_TREE, validateSkillTree(tree)]];
  if (tasks) pairs.push([STORAGE_KEYS.TASKS, tasks]);
  if (logs) pairs.push([STORAGE_KEYS.STUDY_LOGS, logs]);
  if (goal !== undefined) pairs.push([STORAGE_KEYS.CURRENT_GOAL, { version: 2, goal }]);
  try {
    writeStorageItems(pairs);
  } catch {
    throw new Error('保存参考路径失败，请重试。');
  }
  if (tasks) useTaskStore.setState({ tasks });
  if (logs) useStudyLogStore.getState().loadLogs();
  if (goal !== undefined) useCurrentGoalStore.setState({ goal, isLoaded: true });
}

export const useSkillTreeStore = create<SkillTreeStore>((set, get) => {
  const currentTree = () => {
    const { isLoaded, error, topics, completedIds } = get();
    if (!isLoaded || error) throw new Error(error || '参考路径正在加载。');
    const tree = readSkillTree();
    if (JSON.stringify(tree) !== JSON.stringify({ version: 1, topics, completedIds })) {
      throw new Error('参考路径已在其他页面更新，请刷新后重试。');
    }
    return tree;
  };
  return {
    topics: [],
    completedIds: [],
    isLoaded: false,
    error: '',
    loadSkillTree: () => {
      if (get().isLoaded) return;
      try {
        const { topics, completedIds } = readSkillTree();
        set({ topics, completedIds, isLoaded: true });
      } catch {
        set({ error: '参考路径读取失败，已保留浏览器中的原始数据。', isLoaded: true });
      }
    },
    saveTopic: (fields, id) => {
      const tree = currentTree();
      const previous = tree.topics.find((topic) => topic.id === id);
      if (id && !previous) throw new Error('找不到这个主题。');
      const topic = { ...fields, name: fields.name.trim(), description: fields.description.trim(), category: fields.category.trim(),
        id: id ?? generateId(), estimatedTime: previous?.estimatedTime ?? 0 };
      const topics = previous ? tree.topics.map((item) => item.id === id ? topic : item) : [...tree.topics, topic];
      const goal = readCurrentGoal();
      writeChanges({ ...tree, topics }, goal?.type === 'skill' && goal.id === topic.id ? { ...goal, label: topic.name } : undefined);
      set({ topics });
      return topic.id;
    },
    deleteTopic: (id) => {
      const tree = currentTree();
      if (!tree.topics.some((item) => item.id === id)) throw new Error('找不到这个主题。');
      const { tasks, isLoaded } = useTaskStore.getState();
      const storedTasks: unknown = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) ?? '[]');
      if (!isLoaded || JSON.stringify(storedTasks) !== JSON.stringify(tasks)) {
        throw new Error('任务已在其他页面更新，请刷新后重试。');
      }
      const topics = tree.topics.filter((item) => item.id !== id).map((topic) => ({
        ...topic, prerequisites: topic.prerequisites.filter((reference) => reference !== id),
      }));
      const completedIds = tree.completedIds.filter((completedId) => completedId !== id);
      const remaining = tasks.filter((task) => task.parentSkillId !== id);
      const removedTaskIds = new Set(tasks.filter((task) => task.parentSkillId === id).map((task) => task.id));
      const goal = readCurrentGoal();
      const clearGoal = (goal?.type === 'skill' && goal.id === id)
        || (goal?.type === 'task' && removedTaskIds.has(goal.id));
      const logs = removedTaskIds.size ? logsWithoutTaskLinks(removedTaskIds) : undefined;
      writeChanges({ ...tree, topics, completedIds }, clearGoal ? null : undefined, removedTaskIds.size ? remaining : undefined, logs);
      set({ topics, completedIds });
    },
    toggleCompleted: (id) => {
      const tree = currentTree();
      if (!tree.topics.some((item) => item.id === id)) throw new Error('找不到这个主题。');
      const wasCompleted = tree.completedIds.includes(id);
      const completedIds = wasCompleted ? tree.completedIds.filter((item) => item !== id) : [...tree.completedIds, id];
      const goal = readCurrentGoal();
      writeChanges({ ...tree, completedIds, topics: tree.topics === SKILL_PATH ? undefined : tree.topics },
        !wasCompleted && goal?.type === 'skill' && goal.id === id ? null : undefined);
      set({ completedIds });
    },
  };
});
