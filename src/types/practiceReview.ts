import type { GrowthSourceKind } from './growthSuggestions.ts';
import { reviewRecord, reviewText } from './logReview.ts';

export const PRACTICE_REVIEW_MODE = 'practice-review';
export const PRACTICE_REVIEW_ATTACHMENTS_PER_KIND = 2;
export const PRACTICE_REVIEW_TITLE_LIMIT = 200;
export const PRACTICE_REVIEW_EXCERPT_LIMIT = 1200;
export const PRACTICE_REVIEW_GOAL_LIMIT = 100;

export interface PracticeReviewSource {
  kind: 'practice' | GrowthSourceKind;
  title: string;
  excerpt: string;
}

export interface PracticeReviewRequest {
  mode: typeof PRACTICE_REVIEW_MODE;
  sources: PracticeReviewSource[];
}

interface PracticeReviewFinding {
  text: string;
  source: number;
  quote: string;
}

export interface PracticeReviewResult {
  approach?: PracticeReviewFinding;
  verification?: PracticeReviewFinding;
  missing: string;
  nextStep: string;
}

export function readPracticeReviewRequest(value: unknown): PracticeReviewRequest {
  if (!reviewRecord(value) || value.mode !== PRACTICE_REVIEW_MODE || !Array.isArray(value.sources)
    || !value.sources.length || value.sources.length > 1 + 3 * PRACTICE_REVIEW_ATTACHMENTS_PER_KIND) {
    throw new Error('请选择一次实践进行复盘。');
  }
  const sources = value.sources.map((source, index): PracticeReviewSource => {
    if (!reviewRecord(source)) throw new Error('复盘资料格式不正确，请重新选择实践。');
    const { kind, title, excerpt } = source;
    if ((kind !== 'practice' && kind !== 'log' && kind !== 'entry' && kind !== 'code')
      || (index === 0) !== (kind === 'practice')
      || typeof title !== 'string' || !title.trim() || title.length > PRACTICE_REVIEW_TITLE_LIMIT
      || typeof excerpt !== 'string' || excerpt.length > PRACTICE_REVIEW_EXCERPT_LIMIT) {
      throw new Error('复盘资料格式不正确，请重新选择实践。');
    }
    return { kind, title, excerpt };
  });
  if (!sources.some(({ excerpt }) => excerpt.trim())) throw new Error('请先补充实践备注或关联资料。');
  return { mode: PRACTICE_REVIEW_MODE, sources };
}

function readFinding(value: unknown, sources: PracticeReviewSource[]): PracticeReviewFinding | undefined {
  if (!reviewRecord(value) || typeof value.source !== 'number' || !Number.isInteger(value.source)) return;
  const source = sources[value.source - 1];
  const text = reviewText(value.text, 320);
  const quote = typeof value.quote === 'string' ? value.quote.trim() : '';
  if (text && quote && quote.length <= 180 && source?.excerpt.includes(quote)) {
    return { text, source: value.source, quote };
  }
}

export function readPracticeReviewResult(value: unknown, sources: PracticeReviewSource[]): PracticeReviewResult {
  const message = '模型没有返回可核对的复盘，请重试。';
  if (!reviewRecord(value)) throw new Error(message);
  const approach = readFinding(value.approach, sources);
  const observed = readFinding(value.verification, sources);
  const observedIn = observed && sources[observed.source - 1].kind;
  const verification = observedIn === 'practice' || observedIn === 'log' ? observed : undefined;
  const missing = reviewText(value.missing, 200);
  const nextStep = reviewText(value.nextStep, PRACTICE_REVIEW_GOAL_LIMIT);
  if (!approach && !verification && !missing && !nextStep) throw new Error(message);
  return { approach, verification, missing, nextStep };
}
