import { SKILL_CATEGORIES, SKILL_PATH } from '../data/skillPath';
import type { SkillNodeDefinition } from '../data/skillPath';
import { STORAGE_KEYS } from './storage';

export interface SkillTreeStorage {
  version: 1;
  completedIds: string[];
  topics?: SkillNodeDefinition[];
}

export const SKILL_TOPIC_NAME_LIMIT = 100;
export const SKILL_TOPIC_DESCRIPTION_LIMIT = 1200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTopic(value: unknown): value is SkillNodeDefinition {
  return isRecord(value) && typeof value.id === 'string' && Boolean(value.id)
    && typeof value.name === 'string' && Boolean(value.name.trim()) && value.name.length <= SKILL_TOPIC_NAME_LIMIT
    && typeof value.description === 'string' && value.description.length <= SKILL_TOPIC_DESCRIPTION_LIMIT
    && SKILL_CATEGORIES.some(({ id }) => id === value.category)
    && typeof value.estimatedTime === 'number' && Number.isFinite(value.estimatedTime) && value.estimatedTime >= 0
    && Array.isArray(value.prerequisites) && value.prerequisites.every((id) => typeof id === 'string')
    && new Set(value.prerequisites).size === value.prerequisites.length;
}

export function validateSkillTree(value: unknown): SkillTreeStorage {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.completedIds)
    || !value.completedIds.every((id) => typeof id === 'string')) throw new Error('技能进度格式不正确。');
  const topics = value.topics;
  if (topics !== undefined) {
    if (!Array.isArray(topics) || !topics.every(isTopic)) throw new Error('参考主题格式不正确。');
    const ids = new Set(topics.map(({ id }) => id));
    if (ids.size !== topics.length || topics.some(({ id, prerequisites }) =>
      prerequisites.some((reference) => reference === id || !ids.has(reference)))) {
      throw new Error('参考主题包含重复或无效的引用。');
    }
  }
  return { version: 1, completedIds: value.completedIds, topics };
}

export function readSkillTree(): Required<SkillTreeStorage> {
  const raw = localStorage.getItem(STORAGE_KEYS.SKILL_TREE);
  const data = raw === null ? { version: 1 as const, completedIds: [] } : validateSkillTree(JSON.parse(raw));
  const topics = data.topics ?? SKILL_PATH;
  const ids = new Set(topics.map(({ id }) => id));
  return { version: 1, topics, completedIds: [...new Set(data.completedIds)].filter((id) => ids.has(id)) };
}
