import { GROWTH_DOMAINS } from '../data/growthPresets';
import type { GrowthData, GrowthDomain, GrowthOutcome, GrowthPractice, StudyLog } from '../types';
import { isCalendarDate } from './storage';

export const emptyGrowth = (): GrowthData => ({ version: 1, outcomes: [] });

export function logLabel(log: StudyLog) {
  const title = log.content.match(/^#{1,6}\s+(.+)$/m)?.[1];
  return title ? `${log.date} · ${title}` : log.date;
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
    && typeof value.note === 'string' && uniqueStrings(value.logIds) && uniqueStrings(value.entryIds);
}

function isOutcome(value: unknown): value is GrowthOutcome {
  return isRecord(value) && nonempty(value.id) && nonempty(value.title)
    && uniqueStrings(value.domains) && value.domains.every((domain) => GROWTH_DOMAINS.includes(domain as GrowthDomain))
    && Array.isArray(value.practices) && value.practices.length > 0 && value.practices.every(isPractice)
    && new Set(value.practices.map((practice) => practice.id)).size === value.practices.length;
}

export function validateGrowth(value: unknown): GrowthData {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.outcomes)
    || !value.outcomes.every(isOutcome) || new Set(value.outcomes.map((outcome) => outcome.id)).size !== value.outcomes.length) {
    throw new Error('成长记录格式不正确，无法读取。');
  }
  return { version: 1, outcomes: value.outcomes };
}
