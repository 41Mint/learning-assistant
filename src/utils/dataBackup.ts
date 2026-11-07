import { getImages, IMAGE_PREFIX, writeImages } from './imageStorage';
import type { StoredImage } from './imageStorage';
import { isCalendarDate, STORAGE_KEYS } from './storage';
import type { GrowthData, KnowledgeData, LearningTask, StudyLog } from '../types';
import { emptyKnowledge, validateKnowledge } from './knowledge';
import { emptyGrowth, validateGrowth } from './growth';

interface BackupImage { id: string; name: string; type: string; base64: string }
interface BackupData {
  studyLogs: StudyLog[];
  tasks: LearningTask[];
  skillTree: Record<string, unknown> | null;
  currentGoal: Record<string, unknown> | null;
  streak: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  pomodoroToday: Record<string, unknown> | null;
  knowledge: KnowledgeData;
  growth: GrowthData;
}
export interface BackupFile {
  format: 'learning-assistant-backup';
  version: 1 | 2 | 3 | 4;
  exportedAt: string;
  data: BackupData;
  images: BackupImage[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every((item) => typeof item === 'string'); }
function number(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
function isLog(value: unknown): value is StudyLog {
  return isRecord(value) && typeof value.id === 'string' && isCalendarDate(value.date) && number(value.duration)
    && typeof value.content === 'string' && strings(value.tags) && strings(value.knowledgePoints)
    && number(value.createdAt) && number(value.updatedAt);
}
function isTask(value: unknown): value is LearningTask {
  return isRecord(value) && typeof value.id === 'string' && typeof value.parentSkillId === 'string'
    && typeof value.title === 'string' && typeof value.description === 'string' && typeof value.completed === 'boolean'
    && number(value.createdAt) && number(value.updatedAt);
}
function optionalRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new Error('备份中的设置或进度格式不正确。');
  return value;
}

export function parseBackup(value: unknown): BackupFile {
  if (!isRecord(value) || value.format !== 'learning-assistant-backup' || (value.version !== 1 && value.version !== 2 && value.version !== 3 && value.version !== 4)
    || typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt)) || !isRecord(value.data)) {
    throw new Error('无法识别该备份，请选择由学习助手导出的 JSON 文件。');
  }
  const raw = value.data;
  if (!Array.isArray(raw.studyLogs) || !raw.studyLogs.every(isLog) || !Array.isArray(raw.tasks) || !raw.tasks.every(isTask)) {
    throw new Error('学习记录或任务字段不完整，未修改本地数据。');
  }
  const studyLogs: StudyLog[] = raw.studyLogs;
  const tasks: LearningTask[] = raw.tasks;
  const knowledge = value.version >= 3 ? validateKnowledge(raw.knowledge, new Set(studyLogs.map((log) => log.id))) : emptyKnowledge();
  const growth = value.version === 4 ? validateGrowth(raw.growth) : emptyGrowth();
  if (new Set(studyLogs.map((log) => log.date)).size !== studyLogs.length
    || new Set(studyLogs.map((log) => log.id)).size !== studyLogs.length
    || new Set(tasks.map((task) => task.id)).size !== tasks.length) throw new Error('备份存在重复记录，无法恢复。');
  const skillTree = optionalRecord(raw.skillTree);
  if (skillTree && (skillTree.version !== 1 || !strings(skillTree.completedIds))) throw new Error('技能进度格式不正确。');
  const currentGoal = optionalRecord(raw.currentGoal);
  if (currentGoal && !(
    currentGoal.version === 1 && (currentGoal.skillId === null || typeof currentGoal.skillId === 'string')
    || currentGoal.version === 2 && (currentGoal.goal === null || isRecord(currentGoal.goal)
      && ['skill', 'task'].includes(String(currentGoal.goal.type)) && typeof currentGoal.goal.id === 'string' && typeof currentGoal.goal.label === 'string')
  )) throw new Error('当前学习目标格式不正确。');
  const streak = optionalRecord(raw.streak);
  if (streak && (!number(streak.currentStreak) || !number(streak.longestStreak) || !number(streak.totalDays)
    || !(streak.lastStudyDate === null || isCalendarDate(streak.lastStudyDate)))) throw new Error('打卡记录格式不正确。');
  const images: BackupImage[] = [];
  if (value.version >= 2) {
    if (!Array.isArray(value.images)) throw new Error('备份缺少图片数据。');
    for (const image of value.images) {
      if (!isRecord(image) || typeof image.id !== 'string' || typeof image.name !== 'string'
        || !['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(String(image.type)) || typeof image.base64 !== 'string') {
        throw new Error('图片数据格式不正确。');
      }
      try { atob(image.base64); } catch { throw new Error('图片内容损坏，未修改本地数据。'); }
      images.push({ id: image.id, name: image.name, type: String(image.type), base64: image.base64 });
    }
  }
  const ids = new Set(images.map((image) => image.id));
  if (ids.size !== images.length) throw new Error('图片 ID 重复，无法恢复。');
  for (const content of [...studyLogs.map((log) => log.content), ...knowledge.entries.map((entry) => entry.content)]) {
    for (const match of content.matchAll(/learning-image:([a-zA-Z0-9-]+)/g)) {
      if (!ids.has(match[1])) throw new Error(`备份缺少记录引用的图片：${match[1]}`);
    }
  }
  return {
    format: 'learning-assistant-backup', version: value.version, exportedAt: value.exportedAt,
    data: { studyLogs, tasks, skillTree, currentGoal, streak, settings: optionalRecord(raw.settings), pomodoroToday: optionalRecord(raw.pomodoroToday), knowledge, growth }, images,
  };
}

function encodeImage(image: StoredImage): Promise<BackupImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ id: image.id, name: image.name, type: image.blob.type, base64: String(reader.result).split(',')[1] });
    reader.onerror = () => reject(new Error(`读取图片 ${image.name} 失败。`));
    reader.readAsDataURL(image.blob);
  });
}

export async function createBackup(): Promise<BackupFile> {
  const raw: Record<string, unknown> = {};
  for (const [name, key] of Object.entries({
    studyLogs: STORAGE_KEYS.STUDY_LOGS, tasks: STORAGE_KEYS.TASKS, skillTree: STORAGE_KEYS.SKILL_TREE,
    currentGoal: STORAGE_KEYS.CURRENT_GOAL, streak: STORAGE_KEYS.STREAK, settings: STORAGE_KEYS.SETTINGS, pomodoroToday: STORAGE_KEYS.POMODORO_TODAY,
    knowledge: STORAGE_KEYS.KNOWLEDGE,
    growth: STORAGE_KEYS.GROWTH,
  })) {
    const item = localStorage.getItem(key);
    try { raw[name] = item === null ? null : JSON.parse(item); }
    catch { throw new Error(`无法读取 ${name}，请保留现有数据并联系开发者。`); }
  }
  raw.studyLogs ??= [];
  raw.tasks ??= [];
  raw.knowledge ??= emptyKnowledge();
  raw.growth ??= emptyGrowth();
  const images = await Promise.all((await getImages()).map(encodeImage));
  return parseBackup({ format: 'learning-assistant-backup', version: 4, exportedAt: new Date().toISOString(), data: raw, images });
}

export async function restoreBackup(backup: BackupFile): Promise<void> {
  // 再次校验后，先解码并准备数据；任何失败均不触发页面刷新。
  const checked = parseBackup(backup);
  const images: StoredImage[] = checked.images.map((image) => ({
    id: image.id, name: image.name,
    blob: new Blob([Uint8Array.from(atob(image.base64), (character) => character.charCodeAt(0))], { type: image.type }),
  }));
  const mappings: Array<[string, unknown]> = [
    [STORAGE_KEYS.STUDY_LOGS, checked.data.studyLogs], [STORAGE_KEYS.TASKS, checked.data.tasks],
    [STORAGE_KEYS.SKILL_TREE, checked.data.skillTree], [STORAGE_KEYS.CURRENT_GOAL, checked.data.currentGoal],
    [STORAGE_KEYS.STREAK, checked.data.streak], [STORAGE_KEYS.SETTINGS, checked.data.settings], [STORAGE_KEYS.POMODORO_TODAY, checked.data.pomodoroToday],
    [STORAGE_KEYS.KNOWLEDGE, checked.data.knowledge],
    [STORAGE_KEYS.GROWTH, checked.data.growth],
  ];
  // 避免旧版按日调试键在刷新后重新迁移出不属于这份备份的记录。
  const keys = [...mappings.map(([key]) => key), ...Object.keys(localStorage).filter((key) => key.startsWith('learning-assistant:log:'))];
  const previous = keys.map((key) => [key, localStorage.getItem(key)] as const);
  try {
    keys.forEach((key) => localStorage.removeItem(key));
    mappings.forEach(([key, value]) => { if (value !== null) localStorage.setItem(key, JSON.stringify(value)); });
    // IDB 事务若失败会保留原图；此后没有会失败的持久化步骤。
    await writeImages(images, true);
  } catch (error) {
    keys.forEach((key) => localStorage.removeItem(key));
    previous.forEach(([key, value]) => { if (value !== null) localStorage.setItem(key, value); });
    throw new Error(`恢复失败，已回退原数据：${error instanceof Error ? error.message : '浏览器存储异常'}`);
  }
}

export { IMAGE_PREFIX };
