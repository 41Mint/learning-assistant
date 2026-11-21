import type { StudyLog, TrashedStudyLog } from '../types';
import { generateId, getTodayDate, STORAGE_KEYS } from './storage';

export type StoredStudyLog = StudyLog & { deletedAt?: number };

export function isTrashedLog(log: StoredStudyLog): log is TrashedStudyLog {
  return log.deletedAt !== undefined;
}

export function readStoredLogs(): StoredStudyLog[] {
  const raw = localStorage.getItem(STORAGE_KEYS.STUDY_LOGS);
  const logs: unknown = raw === null ? [] : JSON.parse(raw);
  if (!Array.isArray(logs)) throw new Error('学习日志格式不正确。');
  return logs;
}

export function logsWithTaskLinks(logId: string, taskIds: readonly string[], previousIds: readonly string[], validIds: ReadonlySet<string>): StoredStudyLog[] | undefined {
  const stored = readStoredLogs();
  const log = stored.find((item) => item.id === logId && !isTrashedLog(item));
  if (!log) throw new Error('这篇日志已不存在，请重新打开后再试。');
  const current = log.taskIds ?? [];
  if (current.length !== previousIds.length || current.some((id, index) => id !== previousIds[index])) {
    throw new Error('关联任务已更新，请关闭后重新打开选择。');
  }
  const next = [...new Set(taskIds)];
  if (next.some((id) => !validIds.has(id))) throw new Error('所选任务已不存在，请重新选择。');
  if (current.length === next.length && current.every((id, index) => id === next[index])) return;
  const updated = { ...log, taskIds: next.length ? next : undefined, updatedAt: Date.now() };
  return stored.map((item) => item.id === logId ? updated : item);
}

export function logsWithoutTaskLinks(removedIds: ReadonlySet<string>): StoredStudyLog[] | undefined {
  const logs = readStoredLogs();
  let changed = false;
  const updated = logs.map((log) => {
    if (!log.taskIds?.some((id) => removedIds.has(id))) return log;
    changed = true;
    const taskIds = log.taskIds.filter((id) => !removedIds.has(id));
    return { ...log, taskIds: taskIds.length ? taskIds : undefined, updatedAt: Date.now() };
  });
  return changed ? updated : undefined;
}

export function createTodayLogDraft(): StudyLog {
  const date = getTodayDate();
  const now = Date.now();
  return { id: generateId(), date, content: `### ${date}\n\n`, duration: 0, tags: [], knowledgePoints: [], createdAt: now, updatedAt: now };
}

export function isEmptyLogContent(content: string, date: string): boolean {
  const text = content.trim();
  return text === '' || text === `### ${date}`;
}
