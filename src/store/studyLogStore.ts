import { create } from 'zustand';
import { STORAGE_KEYS, LEGACY_LOG_PREFIX, generateId, getTodayDate, isCalendarDate } from '../utils/storage';
import { createTodayLogDraft, isEmptyLogContent, isTrashedLog, readStoredLogs } from '../utils/studyLogs';
import type { StoredStudyLog } from '../utils/studyLogs';
import type { LearningTask, StudyLog, TrashedStudyLog } from '../types';

function migrateLegacyLogs(logs: StoredStudyLog[]): StoredStudyLog[] {
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

function splitLogs(stored: StoredStudyLog[]) {
  const logs = stored.filter((log) => !isTrashedLog(log));
  return { logs, trashedLogs: stored.filter(isTrashedLog), currentLog: logs.find(({ date }) => date === getTodayDate()) ?? null };
}

function saveStoredLogs(stored: StoredStudyLog[]) {
  localStorage.setItem(STORAGE_KEYS.STUDY_LOGS, JSON.stringify(stored));
  return { ...splitLogs(stored), error: '' };
}

interface StudyLogStore {
  logs: StudyLog[];
  trashedLogs: TrashedStudyLog[];
  error: string;
  currentLog: StudyLog | null;

  // 加载所有日志
  loadLogs: () => void;

  // 获取今天的日志（如果不存在则创建）
  getTodayLog: () => StudyLog;

  // 保存日志
  saveLog: (log: StudyLog) => void;
  trashLog: (id: string) => void;
  restoreLog: (id: string, date: string) => void;
  appendToDate: (date: string, content: string) => void;
  updateLogContent: (id: string, content: string, originalContent?: string, addedTags?: string[]) => void;
  setLogTasks: (id: string, taskIds: string[], previousTaskIds: readonly string[]) => void;

  // 更新当前日志内容
  updateContent: (content: string) => void;

  // 添加标签
  addTag: (tag: string) => void;
  changeTag: (logId: string, tag: string, add: boolean) => void;
  renameTag: (logId: string, previous: string, value: string) => void;

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

export function storedStudyLogIds({ logs, trashedLogs }: Pick<StudyLogStore, 'logs' | 'trashedLogs'>): Set<string> {
  return new Set([...logs, ...trashedLogs].map(({ id }) => id));
}

export const useStudyLogStore = create<StudyLogStore>((set, get) => ({
  logs: [],
  trashedLogs: [],
  error: '',
  currentLog: null,

  loadLogs: () => {
    try {
      const logs = readStoredLogs();
      const migratedLogs = migrateLegacyLogs(logs);
      if (migratedLogs !== logs) set(saveStoredLogs(migratedLogs));
      else set({ ...splitLogs(logs), error: '' });
    } catch {
      set({ error: '学习日志读取失败。请先保留现有数据，再检查浏览器存储。' });
    }
  },

  getTodayLog: () => {
    const state = splitLogs(readStoredLogs());
    let log = state.currentLog;
    if (log) {
      set({ ...state, error: '' });
    } else {
      log = createTodayLogDraft();

      try { get().saveLog(log); }
      catch (error) {
        set({ error: '无法创建今日日志，请检查浏览器存储后重试。' });
        throw error;
      }
    }

    return log;
  },

  saveLog: (log: StudyLog) => {
    const stored = readStoredLogs();
    const previous = stored.find(({ id }) => id === log.id);
    if (previous && isTrashedLog(previous)) throw new Error('日志已在回收站，请先恢复再保存。');
    if (stored.some((item) => item.id !== log.id && item.date === log.date && !isTrashedLog(item))) {
      throw new Error('这一天已有学习日志，请重新打开后再保存。');
    }
    // Task links are edited independently and may have changed while a note draft was open.
    const updatedLog = { ...log, taskIds: previous?.taskIds, updatedAt: Date.now() };
    set(saveStoredLogs(previous ? stored.map((item) => item.id === log.id ? updatedLog : item) : [...stored, updatedLog]));
  },

  trashLog: (id) => {
    const stored = readStoredLogs();
    const log = stored.find((item) => item.id === id && !isTrashedLog(item));
    if (!log) throw new Error('这篇日志已不在学习记录中。');
    set(saveStoredLogs(stored.map((item) => item.id === id ? { ...log, deletedAt: Date.now() } : item)));
  },

  restoreLog: (id, date) => {
    if (!isCalendarDate(date)) throw new Error('请选择一个有效的日期。');
    const stored = readStoredLogs();
    const trashed = stored.find((item) => item.id === id && isTrashedLog(item));
    if (!trashed) throw new Error('这篇日志已不在回收站。');
    if (stored.some((item) => item.date === date && !isTrashedLog(item))) {
      throw new Error('该日期已有学习记录，请选择一个空日期。');
    }
    const { deletedAt: _, ...log } = trashed;
    set(saveStoredLogs(stored.map((item) => item.id === id ? { ...log, date } : item)));
  },

  appendToDate: (date, content) => {
    const existing = readStoredLogs().find((log) => log.date === date && !isTrashedLog(log));
    const now = Date.now();
    const log: StudyLog = existing ?? {
      id: generateId(), date, duration: 0, content: '', tags: [], knowledgePoints: [], createdAt: now, updatedAt: now,
    };
    const emptyHeading = isEmptyLogContent(log.content, date);
    get().saveLog({ ...log, content: emptyHeading ? content : `${log.content.trimEnd()}\n\n---\n\n${content}` });
  },

  updateLogContent: (id, content, originalContent, addedTags) => {
    const log = readStoredLogs().find((candidate) => candidate.id === id && !isTrashedLog(candidate));
    if (!log) throw new Error('这条记录不存在，请重新打开后再编辑。');
    if (originalContent !== undefined && log.content !== originalContent) {
      throw new Error('这篇正文已有新的保存内容。请先复制本次草稿，再重新打开记录核对。');
    }
    const tags = addedTags?.length ? [...new Set([...log.tags, ...addedTags])] : log.tags;
    get().saveLog({ ...log, content, tags });
  },

  setLogTasks: (id, taskIds, previousTaskIds) => {
    const stored = readStoredLogs();
    const log = stored.find((item) => item.id === id && !isTrashedLog(item));
    if (!log) throw new Error('这篇日志已不存在，请重新打开后再试。');
    const current = log.taskIds ?? [];
    if (current.length !== previousTaskIds.length || current.some((taskId, index) => taskId !== previousTaskIds[index])) {
      throw new Error('关联任务已更新，请关闭后重新打开选择。');
    }
    const tasks: LearningTask[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) ?? '[]');
    const validIds = new Set(tasks.map((task) => task.id));
    const next = [...new Set(taskIds)];
    if (next.some((taskId) => !validIds.has(taskId))) throw new Error('所选任务已不存在，请重新选择。');
    if (current.length === next.length && current.every((taskId, index) => taskId === next[index])) return;
    const updated = { ...log, taskIds: next.length ? next : undefined, updatedAt: Date.now() };
    set(saveStoredLogs(stored.map((item) => item.id === id ? updated : item)));
  },

  updateContent: (content: string) => {
    const currentLog = get().currentLog;
    if (currentLog) {
      get().saveLog({ ...currentLog, content });
    }
  },

  changeTag: (logId, tag, add) => {
    const log = readStoredLogs().find((candidate) => candidate.id === logId && !isTrashedLog(candidate));
    if (!log) throw new Error('这条记录不存在，请刷新后重试。');
    const label = add ? tag.trim() : tag;
    if ((add && !label) || log.tags.includes(label) === add) return;
    const tags = add ? [...log.tags, label] : log.tags.filter((item) => item !== label);
    get().saveLog({ ...log, tags });
  },

  renameTag: (logId, previous, value) => {
    const log = readStoredLogs().find((candidate) => candidate.id === logId && !isTrashedLog(candidate));
    if (!log?.tags.includes(previous)) throw new Error('原标签已不存在，请重新打开日志。');
    const tag = value.trim();
    if (tag === previous) return;
    if (!tag || log.tags.includes(tag)) throw new Error('标签不能为空，也不能与已有标签重复。');
    get().saveLog({ ...log, tags: log.tags.map((item) => item === previous ? tag : item) });
  },

  addTag: (tag) => {
    const currentLog = get().currentLog;
    if (currentLog) get().changeTag(currentLog.id, tag, true);
  },

  removeTag: (tag) => {
    const currentLog = get().currentLog;
    if (currentLog) get().changeTag(currentLog.id, tag, false);
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
