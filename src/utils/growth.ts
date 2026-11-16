import { GROWTH_DOMAINS, GROWTH_PRESETS } from '../data/growthPresets';
import type { GrowthData, GrowthDomain, GrowthGroup, GrowthOutcome, GrowthPractice, SavedExercise, StudyLog } from '../types';
import { normalizedName } from './knowledge';
import { isCalendarDate } from './storage';

export const emptyGrowth = (): GrowthData => ({ version: 1, outcomes: [], exercises: [], hiddenPresetIds: [], groups: [] });

export function growthExercises({ exercises, hiddenPresetIds }: Pick<GrowthData, 'exercises' | 'hiddenPresetIds'>): SavedExercise[] {
  const savedIds = new Set(exercises.map(({ id }) => id));
  return [...exercises, ...GROWTH_PRESETS.filter(({ id }) => !savedIds.has(id)).map(({ id, title, domains, cue }) => ({
    id, title, domains, action: cue, done: '', sources: { logIds: [], entryIds: [], codeVersionIds: [] },
  }))].filter(({ id }) => !hiddenPresetIds.includes(id));
}

export function orderGrowthCards<T extends { id: string }>(cards: T[], order: string[] | undefined): T[] {
  if (!order?.length) return cards;
  const byId = new Map(cards.map((card) => [card.id, card]));
  const placed = order.flatMap((id) => byId.get(id) ?? []);
  const placedIds = new Set(placed.map(({ id }) => id));
  let next = 0;
  return cards.map((card) => placedIds.has(card.id) ? placed[next++] : card);
}

export function logLabel(log: StudyLog) {
  const title = log.content.match(/^#{1,6}\s+(.+)$/m)?.[1];
  return title && title.trim() !== log.date ? `${log.date} · ${title}` : log.date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function uniqueStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonempty) && new Set(value).size === value.length;
}

function isPractice(value: unknown): value is GrowthPractice {
  return isRecord(value) && nonempty(value.id) && isCalendarDate(value.date)
    && typeof value.note === 'string' && uniqueStrings(value.logIds) && uniqueStrings(value.entryIds)
    && (value.codeVersionIds === undefined || uniqueStrings(value.codeVersionIds));
}

function isCard(value: unknown): value is Pick<GrowthOutcome, 'id' | 'title' | 'domains'> {
  return isRecord(value) && nonempty(value.id) && nonempty(value.title)
    && uniqueStrings(value.domains) && value.domains.every((domain) => GROWTH_DOMAINS.includes(domain as GrowthDomain));
}

function isOutcome(value: unknown): value is GrowthOutcome {
  return isCard(value) && 'practices' in value
    && (!('description' in value) || value.description === undefined || typeof value.description === 'string')
    && Array.isArray(value.practices) && value.practices.length > 0 && value.practices.every(isPractice)
    && new Set(value.practices.map((practice) => practice.id)).size === value.practices.length;
}

function isExercise(value: unknown): value is SavedExercise {
  return isCard(value) && 'action' in value && typeof value.action === 'string' && 'done' in value && typeof value.done === 'string'
    && 'sources' in value && isRecord(value.sources) && uniqueStrings(value.sources.logIds)
    && uniqueStrings(value.sources.entryIds) && uniqueStrings(value.sources.codeVersionIds);
}

function isGroup(value: unknown): value is GrowthGroup {
  return isRecord(value) && nonempty(value.id) && typeof value.name === 'string' && !!value.name.trim()
    && value.name.length <= 60 && uniqueStrings(value.cardIds)
    && (value.description === undefined || (typeof value.description === 'string' && value.description.length <= 600));
}

export function validateGrowth(value: unknown): GrowthData {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.outcomes)
    || !value.outcomes.every(isOutcome) || new Set(value.outcomes.map((outcome) => outcome.id)).size !== value.outcomes.length) {
    throw new Error('成长记录格式不正确，无法读取。');
  }
  const exercises = value.exercises === undefined ? [] : value.exercises;
  const hiddenPresetIds = value.hiddenPresetIds === undefined ? [] : value.hiddenPresetIds;
  const groups = value.groups === undefined ? [] : value.groups;
  if (!Array.isArray(exercises) || !exercises.every(isExercise) || new Set(exercises.map(({ id }) => id)).size !== exercises.length
    || !Array.isArray(groups) || !groups.every(isGroup) || new Set(groups.map(({ id }) => id)).size !== groups.length
    || new Set(groups.map(({ name }) => normalizedName(name))).size !== groups.length
    || !uniqueStrings(hiddenPresetIds) || hiddenPresetIds.some((id) => !GROWTH_PRESETS.some((preset) => preset.id === id))) {
    throw new Error('练习卡片或卡组格式不正确。');
  }
  const validIds = new Set([...value.outcomes, ...exercises, ...GROWTH_PRESETS].map(({ id }) => id));
  const groupedIds = groups.flatMap(({ cardIds }) => cardIds);
  if (groupedIds.some((id) => !validIds.has(id)) || new Set(groupedIds).size !== groupedIds.length) {
    throw new Error('卡组包含重复或无效的卡片。');
  }
  if (value.cardOrder !== undefined && !uniqueStrings(value.cardOrder)) throw new Error('卡片顺序格式不正确。');
  const cardOrder = value.cardOrder?.filter((id) => validIds.has(id));
  const boardOrder: GrowthData['boardOrder'] = {};
  if (value.boardOrder !== undefined) {
    if (!isRecord(value.boardOrder)) throw new Error('看板顺序格式不正确。');
    const tileIds = new Set([...Array.from(validIds, (id) => `card:${id}`), ...groups.map(({ id }) => `group:${id}`)]);
    for (const view of ['recent', 'try'] as const) {
      const order = value.boardOrder[view];
      if (order === undefined) continue;
      if (!uniqueStrings(order)) throw new Error('看板顺序格式不正确。');
      const validOrder = order.filter((id) => tileIds.has(id));
      if (validOrder.length) boardOrder[view] = validOrder;
    }
  }
  return { version: 1, outcomes: value.outcomes, exercises, hiddenPresetIds, groups,
    ...(cardOrder?.length ? { cardOrder } : {}), ...(Object.keys(boardOrder).length ? { boardOrder } : {}) };
}
