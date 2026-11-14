export const ASSISTANT_CHAT_ENDPOINT = '/api/assistant-chat';
export const CHAT_QUESTION_LIMIT = 2000;
export const CHAT_ANSWER_LIMIT = 12000;
export const CHAT_HISTORY_LIMIT = 8;
export const CHAT_CODE_LIMIT = 8000;
export const CHAT_CODE_CONTEXT_LIMIT = 4000;
export const CHAT_SCRIPT_LIMIT = 24000;
export const CHAT_GROUP_CARD_LIMIT = 30;
export const CHAT_GROUP_DESCRIPTION_LIMIT = 240;
export const ASSISTANT_REQUEST_BYTES = 256 * 1024;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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
export interface ChatGrowthGroup {
  name: string;
  totalCards: number;
  cards: (ChatGrowthCard & { completed: boolean })[];
}

export interface ChatRequest {
  question: string;
  history: ChatMessage[];
  log?: ChatLog;
  code?: ChatCode;
  script?: ChatScript;
  growthCard?: ChatGrowthCard;
  growthGroup?: ChatGrowthGroup;
}
