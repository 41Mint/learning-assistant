import { create } from 'zustand';
import { getStorageItem, setStorageItem, STORAGE_KEYS, LEGACY_LOG_PREFIX, generateId, getTodayDate } from '../utils/storage';
import type { StudyLog } from '../types';

function migrateLegacyLogs(logs: StudyLog[]): StudyLog[] {
  const knownDates = new Set(logs.map((log) => log.date));
  const migratedLogs: StudyLog[] = [];

  Object.keys(localStorage)
    .filter((key) => key.startsWith(LEGACY_LOG_PREFIX))
    .forEach((key) => {
      const date = key.slice(LEGACY_LOG_PREFIX.length);
      if (knownDates.has(date)) return;

      try {
        const legacyLog = JSON.parse(localStorage.getItem(key) || '{}') as { duration?: unknown; content?: unknown };
        if (typeof legacyLog.duration !== 'number') return;

        const now = Date.now();
        migratedLogs.push({
          id: generateId(),
          date,
          duration: legacyLog.duration,
          content: typeof legacyLog.content === 'string' ? legacyLog.content : '',
          tags: [],
          knowledgePoints: [],
          createdAt: now,
          updatedAt: now,
        });
        knownDates.add(date);
      } catch {
        // 忽略无法解析的旧调试数据，避免影响正式学习日志加载。
      }
    });

  return migratedLogs.length > 0 ? [...logs, ...migratedLogs] : logs;
}

interface StudyLogStore {
  logs: StudyLog[];
  currentLog: StudyLog | null;

  // 加载所有日志
  loadLogs: () => void;

  // 获取今天的日志（如果不存在则创建）
  getTodayLog: () => StudyLog;

  // 保存日志
  saveLog: (log: StudyLog) => void;
  appendToDate: (date: string, content: string) => void;
  updateLogContent: (id: string, content: string, originalContent?: string) => void;

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
  addDuration: (minutes: number, contextTag?: string) => void;

  // 获取指定日期的日志
  getLogByDate: (date: string) => StudyLog | undefined;
}

export const useStudyLogStore = create<StudyLogStore>((set, get) => ({
  logs: [],
  currentLog: null,

  loadLogs: () => {
    const logs = getStorageItem<StudyLog[]>(STORAGE_KEYS.STUDY_LOGS, []);
    const migratedLogs = migrateLegacyLogs(logs);
    if (migratedLogs !== logs) {
      setStorageItem(STORAGE_KEYS.STUDY_LOGS, migratedLogs);
    }
    set({ logs: migratedLogs });
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

    // 先持久化；配额不足时抛错，界面保留草稿，不误报保存成功。
    localStorage.setItem(STORAGE_KEYS.STUDY_LOGS, JSON.stringify(newLogs));
    set({ logs: newLogs, ...(updatedLog.date === getTodayDate() ? { currentLog: updatedLog } : {}) });
  },

  appendToDate: (date, content) => {
    const existing = get().logs.find((log) => log.date === date);
    const now = Date.now();
    const log: StudyLog = existing ?? {
      id: generateId(), date, duration: 0, content: '', tags: [], knowledgePoints: [], createdAt: now, updatedAt: now,
    };
    const emptyHeading = !log.content.trim() || log.content.trim() === `### ${date}`;
    get().saveLog({ ...log, content: emptyHeading ? content : `${log.content.trimEnd()}\n\n---\n\n${content}` });
  },

  updateLogContent: (id, content, originalContent) => {
    const log = get().logs.find((candidate) => candidate.id === id);
    if (!log) throw new Error('这条记录不存在，请重新打开后再编辑。');
    if (originalContent !== undefined && log.content !== originalContent) {
      throw new Error('这篇正文已有新的保存内容。请先复制本次草稿，再重新打开记录核对。');
    }
    get().saveLog({ ...log, content });
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

  addDuration: (minutes: number, contextTag?: string) => {
    const currentLog = get().getTodayLog();
    const tags = contextTag && !currentLog.tags.includes(contextTag)
      ? [...currentLog.tags, contextTag]
      : currentLog.tags;

    get().saveLog({
      ...currentLog,
      duration: currentLog.duration + minutes,
      tags,
    });
  },

  getLogByDate: (date: string) => {
    return get().logs.find(l => l.date === date);
  },
}));
