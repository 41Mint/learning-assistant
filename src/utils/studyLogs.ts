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
