import { STORAGE_PREFIX } from './workspaceMode';

const STORAGE_KEYS = {
  STUDY_LOGS: STORAGE_PREFIX + 'study-logs',
  KNOWLEDGE: STORAGE_PREFIX + 'knowledge',
  GROWTH: STORAGE_PREFIX + 'growth',
  SKILL_TREE: STORAGE_PREFIX + 'skill-tree',
  CURRENT_GOAL: STORAGE_PREFIX + 'current-goal',
  TASKS: STORAGE_PREFIX + 'tasks',
  STREAK: STORAGE_PREFIX + 'streak',
  SETTINGS: STORAGE_PREFIX + 'settings',
  POMODORO_TODAY: STORAGE_PREFIX + 'pomodoro-today',
} as const;
export const LEGACY_LOG_PREFIX = STORAGE_PREFIX + 'log:';

// 获取数据
export function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return defaultValue;
  }
}

// 保存数据
export function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error writing to localStorage:', error);
  }
}

// 删除数据
export function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error removing from localStorage:', error);
  }
}

// 格式化日期为 YYYY-MM-DD
export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 获取今天的日期字符串
export function getTodayDate(): string {
  return formatDate(new Date());
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// 计算两个日期之间的天数差
export function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// 生成唯一ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export { STORAGE_KEYS };
