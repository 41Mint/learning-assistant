import { reviewRecord, reviewText } from './logReview.ts';

export const ASSISTANT_CHAT_ENDPOINT = '/api/assistant-chat';
export const CHAT_QUESTION_LIMIT = 2000;
export const CHAT_ANSWER_LIMIT = 12000;
export const CHAT_HISTORY_LIMIT = 8;
export const CHAT_CODE_LIMIT = 8000;
export const CHAT_CODE_CONTEXT_LIMIT = 4000;
export const CHAT_SCRIPT_LIMIT = 24000;
export const CHAT_GROUP_CARD_LIMIT = 30;
export const CHAT_GROUP_DESCRIPTION_LIMIT = 240;
export const CHAT_TOPIC_TASK_LIMIT = 20;
export const ASSISTANT_REQUEST_BYTES = 256 * 1024;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ConversationAction =
  | { kind: 'review'; date: string; focus?: string; generate?: boolean }
  | { kind: 'findEntry' | 'findPractice' | 'findResources'; query: string }
  | { kind: 'recommend'; focus?: string; generate?: boolean; recentLogs?: boolean }
  | { kind: 'code' };

export function readConversationAction(value: unknown): ConversationAction | undefined {
  if (!reviewRecord(value)) return;
  if (value.kind === 'review') return { kind: 'review', date: reviewText(value.date, 40), focus: reviewText(value.focus, 500), generate: value.generate !== false };
  if (value.kind === 'findEntry' || value.kind === 'findPractice' || value.kind === 'findResources') {
    return { kind: value.kind, query: reviewText(value.query, 160) };
  }
  if (value.kind === 'recommend') return { kind: 'recommend', focus: reviewText(value.focus, 180), generate: true,
    recentLogs: value.recentLogs === true || undefined };
  if (value.kind === 'code') return { kind: 'code' };
}

export function readConversationOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.slice(0, 8).map((item) => reviewText(item, 120)).filter((item) => item && !/[\r\n]/u.test(item)))].slice(0, 3);
}

export interface ChatLog { date: string; text: string }
export interface ChatCodeRange { startLine: number; endLine: number; text: string }
export interface ChatCode extends ChatCodeRange { path: string; context?: ChatCodeRange }
export interface ChatScript {
  path: string;
  project: string;
  totalLines: number;
  sampled: boolean;
  parts: ChatCodeRange[];
  notes: string[];
}
export interface ChatGrowthCard {
  title: string;
  domains: string[];
  description: string;
}
export interface ChatGrowthCards {
  totalCards: number;
  cards: (ChatGrowthCard & { completed: boolean })[];
}
export interface ChatGrowthGroup extends ChatGrowthCards {
  name: string;
}

export interface ChatGrowthGrouping {
  name: string;
  members: number[];
  reason: string;
}

export interface ChatTopic {
  name: string;
  category: string;
  description: string;
  related: string[];
  completed: boolean;
  totalTasks: number;
  tasks: { title: string; completed: boolean }[];
}

export interface ChatTaskSuggestion {
  title: string;
  action: string;
  done: string;
}

export function readTaskSuggestions(value: unknown): ChatTaskSuggestion[] {
  if (!Array.isArray(value)) return [];
  const titles = new Set<string>();
  const suggestions: ChatTaskSuggestion[] = [];
  for (const item of value.slice(0, 3)) {
    if (!reviewRecord(item)) continue;
    const title = reviewText(item.title, 100);
    const action = reviewText(item.action, 360);
    const done = reviewText(item.done, 240);
    const key = title.normalize('NFKC').trim().toLocaleLowerCase();
    if (!key || !action || !done || titles.has(key)) continue;
    titles.add(key);
    suggestions.push({ title, action, done });
  }
  return suggestions;
}

export function readGrowthGrouping(value: unknown, cardCount: number): ChatGrowthGrouping[] {
  if (!Array.isArray(value) || value.length > Math.floor(cardCount / 2)) return [];
  const usedCards = new Set<number>();
  const usedNames = new Set<string>();
  const groups: ChatGrowthGrouping[] = [];
  for (const item of value) {
    if (!reviewRecord(item) || typeof item.name !== 'string' || !Array.isArray(item.members) || item.members.length < 2) return [];
    const name = item.name.trim();
    const key = name.normalize('NFKC').trim().toLocaleLowerCase();
    if (!key || name.length > 60 || usedNames.has(key)) return [];
    const members: number[] = [];
    for (const number of item.members) {
      if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 1 || number > cardCount || usedCards.has(number)) return [];
      members.push(number);
      usedCards.add(number);
    }
    usedNames.add(key);
    groups.push({ name, members, reason: reviewText(item.reason, 200) });
  }
  return groups;
}

export interface ChatRequest {
  question: string;
  history: ChatMessage[];
  log?: ChatLog;
  code?: ChatCode;
  script?: ChatScript;
  growthCard?: ChatGrowthCard;
  growthGroup?: ChatGrowthGroup;
  growthSelection?: ChatGrowthCards;
  topic?: ChatTopic;
}
