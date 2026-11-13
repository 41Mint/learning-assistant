export const ASSISTANT_CHAT_ENDPOINT = '/api/assistant-chat';
export const CHAT_QUESTION_LIMIT = 2000;
export const CHAT_ANSWER_LIMIT = 12000;
export const CHAT_HISTORY_LIMIT = 8;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatLog { date: string; text: string }

export interface ChatRequest {
  question: string;
  history: ChatMessage[];
  log?: ChatLog;
}
