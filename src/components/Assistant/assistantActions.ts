import { normalizedName } from '../../utils/knowledge';
import { formatDate, getTodayDate, isCalendarDate } from '../../utils/storage';

export type AssistantAction = { kind: 'review'; date: string } | { kind: 'findEntry'; query: string };

const datePhrase = '(?:(?:\\d{4}[-/.年])?\\d{1,2}(?:[-/.]|月)\\d{1,2}[日号]?|今天|今日|昨天)';
const datedReview = new RegExp(`^(?:整理|梳理)\\s*(${datePhrase})\\s*(?:的\\s*)?(?:学习)?(?:日志|记录)$`);
const reviewFirst = new RegExp(`^(?:整理|梳理)\\s*(?:学习)?(?:日志|记录)(?:\\s*[：:]?\\s*(${datePhrase}))?$`);

export function assistantAction(text: string): AssistantAction | undefined {
  const request = normalizedName(text).replace(/[。！？!?]+$/, '').replace(/^(?:请(?:你)?\s*)?(?:(?:帮我|为我)\s*)?/, '');
  const review = request.match(datedReview) ?? request.match(reviewFirst);
  if (review) return { kind: 'review', date: review[1] ?? '' };
  if (/^(?:整理|梳理)\s*(?:这篇|当前)(?:的)?(?:学习)?(?:日志|记录)$/.test(request)) return { kind: 'review', date: '' };
  const entry = request.match(/^(?:查找|找一下|查一下|找到|找|搜索|打开|跳转到)\s*(?:(?:知识)?词条\s*[:：]?\s*(.+?)|(.+?)\s*(?:的\s*)?(?:知识)?词条)$/);
  const query = (entry?.[1] ?? entry?.[2])?.replace(/^[「“"']+|[」”"']+$/g, '').trim();
  if (query) return { kind: 'findEntry', query };
}

export function reviewDateFilter(query: string): ((date: string) => boolean) | undefined {
  const text = normalizedName(query);
  if (text === '今天' || text === '今日') return (date) => date === getTodayDate();
  if (text === '昨天') {
    const yesterday = new Date(`${getTodayDate()}T12:00:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    const target = formatDate(yesterday);
    return (date) => date === target;
  }
  const match = text.match(/^(?:(\d{4})[-/.年])?(\d{1,2})(?:[-/.]|月)(\d{1,2})[日号]?$/);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const suffix = '-' + month.padStart(2, '0') + '-' + day.padStart(2, '0');
  if (!isCalendarDate((year ?? '2000') + suffix)) return undefined;
  return (date) => date.endsWith(suffix) && (!year || date.startsWith(year + '-'));
}
