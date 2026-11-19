import { CHAT_HISTORY_LIMIT, CHAT_QUESTION_LIMIT, readConversationAction } from './assistantChat.ts';
import type { ChatMessage, ConversationAction } from './assistantChat.ts';
import { LOG_REVIEW_MAX_SUGGESTIONS, reviewRecord, reviewText } from './logReview.ts';
import type { LogReviewSuggestion } from './logReview.ts';

export interface ReviewItem {
  id: number;
  label: string;
  suggestion: LogReviewSuggestion;
  selected: boolean;
  saved: boolean;
}

export interface ReviewConversationRequest {
  stage: 'conversation';
  question: string;
  history: ChatMessage[];
  date: string;
  items: ReviewItem[];
  lastEdited: number[];
  stale: boolean;
}

export type ReviewField = 'title' | 'category' | 'content' | 'tag' | 'note';
export type ReviewEdit = { id: number; fields: Partial<Record<ReviewField, string>> };
export type ReviewOperation =
  | { kind: 'generate'; focus: string }
  | { kind: 'edit'; edits: ReviewEdit[] }
  | { kind: 'save'; ids: number[] }
  | { kind: 'undo' }
  | { kind: 'navigate'; action: ConversationAction };

export type ReviewConversationResult = { answer: string; operation?: ReviewOperation };

function readDraft(value: unknown): LogReviewSuggestion | undefined {
  if (!reviewRecord(value)) return;
  const evidence = reviewText(value.evidence, 220);
  if (!evidence) return;
  // Manually edited drafts can temporarily have an empty title or body.
  if (value.kind === 'entry') return { kind: 'entry', evidence, title: reviewText(value.title, 100),
    category: reviewText(value.category, 80), content: reviewText(value.content, 1200) };
  if (value.kind === 'tag') return { kind: 'tag', evidence, tag: reviewText(value.tag, 40) };
  if (value.kind === 'link' && reviewText(value.entryId, 160)) {
    return { kind: 'link', evidence, entryId: reviewText(value.entryId, 160), note: reviewText(value.note, 300) };
  }
}

export function readReviewConversationRequest(value: unknown): ReviewConversationRequest {
  const invalid = () => new Error('日志对话资料格式无效。');
  if (!reviewRecord(value) || !Array.isArray(value.history) || value.history.length > CHAT_HISTORY_LIMIT
    || !Array.isArray(value.items) || value.items.length > LOG_REVIEW_MAX_SUGGESTIONS || !Array.isArray(value.lastEdited)
    || typeof value.question !== 'string' || !value.question.trim() || value.question.length > CHAT_QUESTION_LIMIT
    || typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) throw invalid();
  const history = value.history.map((item): ChatMessage => {
    if (!reviewRecord(item) || (item.role !== 'user' && item.role !== 'assistant') || typeof item.content !== 'string') throw invalid();
    return { role: item.role, content: item.content.slice(0, 2000) };
  });
  const ids = new Set<number>();
  const items = value.items.map((item): ReviewItem => {
    if (!reviewRecord(item) || typeof item.id !== 'number' || !Number.isInteger(item.id)
      || item.id < 1 || item.id > LOG_REVIEW_MAX_SUGGESTIONS || ids.has(item.id)) throw invalid();
    const suggestion = readDraft(item.suggestion);
    if (!suggestion) throw invalid();
    ids.add(item.id);
    return { id: item.id, label: reviewText(item.label, 140), suggestion, selected: item.selected === true, saved: item.saved === true };
  });
  return { stage: 'conversation', question: value.question.trim(), date: value.date, history, items,
    lastEdited: value.lastEdited.filter((id): id is number => typeof id === 'number' && ids.has(id)).slice(0, LOG_REVIEW_MAX_SUGGESTIONS),
    stale: value.stale === true };
}

const limits: Record<ReviewField, number> = { title: 100, category: 80, content: 1200, tag: 40, note: 300 };
const fieldNames: Record<LogReviewSuggestion['kind'], ReviewField[]> = {
  entry: ['title', 'category', 'content'], tag: ['tag'], link: ['note'],
};

export function readReviewConversationResult(value: unknown, context: ReviewConversationRequest): ReviewConversationResult {
  const invalid = () => new Error('智能体返回的操作不明确，草稿没有改变。');
  if (!reviewRecord(value)) throw invalid();
  const answer = reviewText(value.answer, 4000);
  if (!answer) throw invalid();
  if (value.operation === null || value.operation === undefined) return { answer };
  const op = value.operation;
  if (!reviewRecord(op)) throw invalid();
  if (op.kind === 'generate') return { answer, operation: { kind: 'generate', focus: reviewText(op.focus, 500) } };
  if (op.kind === 'navigate') {
    const action = readConversationAction(op.action);
    if (!action) throw invalid();
    return { answer, operation: { kind: 'navigate', action } };
  }
  if (context.stale) throw new Error('日志正文已变更，请重新整理后再操作。');
  if (op.kind === 'undo') return { answer, operation: { kind: 'undo' } };
  const available = new Map(context.items.filter(({ saved }) => !saved).map((item) => [item.id, item.suggestion]));
  if (op.kind === 'save' && Array.isArray(op.ids) && op.ids.length && op.ids.length <= available.size
    && op.ids.every((id): id is number => typeof id === 'number' && available.delete(id))) {
    return { answer, operation: { kind: 'save', ids: op.ids as number[] } };
  }
  if (op.kind !== 'edit' || !Array.isArray(op.edits) || !op.edits.length || op.edits.length > available.size) throw invalid();
  const edits = op.edits.map((edit): ReviewEdit => {
    if (!reviewRecord(edit) || typeof edit.id !== 'number' || !reviewRecord(edit.fields)) throw invalid();
    const original = available.get(edit.id);
    if (!original) throw invalid();
    available.delete(edit.id);
    const fields: ReviewEdit['fields'] = {};
    const values = Object.entries(edit.fields);
    if (!values.length) throw invalid();
    for (const [key, text] of values) {
      const field = fieldNames[original.kind].find((item) => item === key);
      if (!field || typeof text !== 'string' || text.trim().length > limits[field]
        || (!text.trim() && field !== 'category' && field !== 'note')) throw invalid();
      fields[field] = text.trim();
    }
    return { id: edit.id, fields };
  });
  return { answer, operation: { kind: 'edit', edits } };
}
