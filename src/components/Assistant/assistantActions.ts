import { normalizedName } from '../../utils/knowledge';
import { formatDate, getTodayDate, isCalendarDate } from '../../utils/storage';

export type { ConversationAction as AssistantAction } from '../../types/assistantChat';
import type { ConversationAction as AssistantAction } from '../../types/assistantChat';

export function isAssistantGuideQuestion(text: string): boolean {
  return /^(?:请问\s*)?(?:(?:你|智能体|助手)(?:可以|能|会|有什么)(?:帮我)?(?:做什么|干什么|做些什么|功能)|(?:怎么|如何)使用(?:这个)?(?:项目|应用|助手|智能体)|(?:这个)?(?:项目|应用)?有什么功能|使用指南)[。？！?!]*$/.test(text.trim());
}

const datePhrase = '(?:(?:\\d{4}[-/.年])?\\d{1,2}(?:[-/.]|月)\\d{1,2}[日号]?|今天|今日|昨天)';
const datedReview = new RegExp(`^(?:整理|梳理)\\s*(${datePhrase})\\s*(?:的\\s*)?(?:学习)?(?:日志|记录)$`);
const reviewFirst = new RegExp(`^(?:整理|梳理)\\s*(?:学习)?(?:日志|记录)(?:\\s*[：:]?\\s*(${datePhrase}))?$`);
const naturalDate = new RegExp(datePhrase, 'u');

export function assistantAction(text: string): AssistantAction | undefined {
  const request = normalizedName(text).replace(/[。！？!?]+$/, '').replace(/^(?:请(?:你)?\s*)?(?:(?:帮我|为我)\s*)?/, '');
  if (/^(?:推荐|生成)\s*(?:一个|一些|几个|一批)?\s*(?:练习|实践)(?:建议|候选)?$/.test(request)) return { kind: 'recommend' };
  if (/^(?:解释|看一下|问一下|分析)\s*(?:一段|这段)?\s*代码$/.test(request)) return { kind: 'code' };
  const review = request.match(datedReview) ?? request.match(reviewFirst);
  if (review) return { kind: 'review', date: review[1] ?? '' };
  if (/^(?:整理|梳理)\s*(?:这篇|当前)(?:的)?(?:学习)?(?:日志|记录)$/.test(request)) return { kind: 'review', date: '' };
  if (/(?:整理|梳理|总结|归纳|提炼).*(?:日志|学习笔记|学习记录)|(?:日志|学习记录|学习笔记).*(?:整理|梳理|总结|归纳|提炼)/u.test(request)
    && !/^(?:怎么|如何|为什么|什么是)|适合吗[？?]?$/u.test(request)) {
    return { kind: 'review', date: request.match(naturalDate)?.[0] ?? '', focus: text };
  }
  const entry = request.match(/^(?:查找|找一下|查一下|找到|找|搜索|打开|跳转到)\s*(?:(?:知识)?词条\s*[:：]?\s*(.+?)|(.+?)\s*(?:的\s*)?(?:知识)?词条)$/);
  const query = (entry?.[1] ?? entry?.[2])?.replace(/^[「“"']+|[」”"']+$/g, '').trim();
  if (query) return { kind: 'findEntry', query };
  const practice = request.match(/^(?:查找|找一下|找|搜索|回看|打开)\s*(?:实践\s*[:：]?\s*(.*?)|(.+?)\s*(?:的\s*)?实践)$/)
    ?? request.match(/^(?:上次|之前)\s*(?:我\s*)?(?:是\s*)?(?:怎么|如何)\s*(?:实现|做出)?\s*(.+?)\s*(?:的)?$/);
  if (practice) return { kind: 'findPractice', query: (practice[1] ?? practice[2] ?? '').trim() };
  const resources = request.match(/^(?:查找|找一下|查一下|搜索|找回)\s*(.*?)(?:的)?(?:相关)?(?:本地)?(?:资料|代码版本|学习日志)$/u);
  if (resources) return { kind: 'findResources', query: resources[1].trim() };
}

export function reviewDateFilter(query: string): ((date: string) => boolean) | undefined {
  const text = normalizedName(query);
  if (text === '今天' || text === '今日') return (date) => date === getTodayDate();
  if (text === '昨天' || text === '前天') {
    const yesterday = new Date(`${getTodayDate()}T12:00:00`);
    yesterday.setDate(yesterday.getDate() - (text === '前天' ? 2 : 1));
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
