import { create } from 'zustand';
import { getStorageItem, setStorageItem, STORAGE_KEYS, generateId, getTodayDate } from '../utils/storage';

interface StudyLog {
  id: string;
  date: string; // YYYY-MM-DD
  duration: number; // 分钟
  content: string; // Markdown内容
  tags: string[];
  knowledgePoints: string[];
  createdAt: number;
  updatedAt: number;
}

interface StudyLogStore {
  logs: StudyLog[];
  currentLog: StudyLog | null;
  isEditing: boolean;

  // 加载所有日志
  loadLogs: () => void;

  // 获取今天的日志（如果不存在则创建）
  getTodayLog: () => StudyLog;

  // 保存日志
  saveLog: (log: StudyLog) => void;

  // 更新当前日志内容
  updateContent: (content: string) => void;

  // 添加标签
  addTag: (tag: string) => void;

  // 删除标签
  removeTag: (tag: string) => void;

  // 添加知识点
  addKnowledgePoint: (point: string) => void;

  // 删除知识点
  removeKnowledgePoint: (point: string) => void;

  // 增加学习时长（分钟）
  addDuration: (minutes: number) => void;

  // 开始编辑
  startEditing: () => void;

  // 结束编辑
  finishEditing: () => void;

  // 获取指定日期的日志
  getLogByDate: (date: string) => StudyLog | undefined;
}

export const useStudyLogStore = create<StudyLogStore>((set, get) => ({
  logs: [],
  currentLog: null,
  isEditing: false,

  loadLogs: () => {
    const logs = getStorageItem<StudyLog[]>(STORAGE_KEYS.STUDY_LOGS, []);
    set({ logs });
  },

  getTodayLog: () => {
    const today = getTodayDate();
    let log = get().logs.find(l => l.date === today);

    if (!log) {
      // 创建今天的日志
      log = {
        id: generateId(),
        date: today,
        duration: 0,
        content: `### ${today}\n\n`,
        tags: [],
        knowledgePoints: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const newLogs = [...get().logs, log];
      set({ logs: newLogs, currentLog: log });
      setStorageItem(STORAGE_KEYS.STUDY_LOGS, newLogs);
    } else {
      set({ currentLog: log });
    }

    return log;
  },

  saveLog: (log: StudyLog) => {
    const updatedLog = { ...log, updatedAt: Date.now() };
    const logs = get().logs;
    const index = logs.findIndex(l => l.id === updatedLog.id);

    let newLogs;
    if (index >= 0) {
      newLogs = [...logs];
      newLogs[index] = updatedLog;
    } else {
      newLogs = [...logs, updatedLog];
    }

    set({ logs: newLogs, currentLog: updatedLog });
    setStorageItem(STORAGE_KEYS.STUDY_LOGS, newLogs);
  },

  updateContent: (content: string) => {
    const currentLog = get().currentLog;
    if (currentLog) {
      get().saveLog({ ...currentLog, content });
    }
  },

  addTag: (tag: string) => {
    const currentLog = get().currentLog;
    if (currentLog && !currentLog.tags.includes(tag)) {
      get().saveLog({
        ...currentLog,
        tags: [...currentLog.tags, tag],
      });
    }
  },

  removeTag: (tag: string) => {
    const currentLog = get().currentLog;
    if (currentLog) {
      get().saveLog({
        ...currentLog,
        tags: currentLog.tags.filter(t => t !== tag),
      });
    }
  },

  addKnowledgePoint: (point: string) => {
    const currentLog = get().currentLog;
    if (currentLog && !currentLog.knowledgePoints.includes(point)) {
      get().saveLog({
        ...currentLog,
        knowledgePoints: [...currentLog.knowledgePoints, point],
      });
    }
  },

  removeKnowledgePoint: (point: string) => {
    const currentLog = get().currentLog;
    if (currentLog) {
      get().saveLog({
        ...currentLog,
        knowledgePoints: currentLog.knowledgePoints.filter(p => p !== point),
      });
    }
  },

  addDuration: (minutes: number) => {
    const currentLog = get().currentLog;
    if (currentLog) {
      get().saveLog({
        ...currentLog,
        duration: currentLog.duration + minutes,
      });
    }
  },

  startEditing: () => set({ isEditing: true }),

  finishEditing: () => set({ isEditing: false }),

  getLogByDate: (date: string) => {
    return get().logs.find(l => l.date === date);
  },
}));
