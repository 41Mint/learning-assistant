import { readEvidenceFinding, readEvidenceSource } from './assistantEvidence.ts';
import type { EvidenceFinding, EvidenceSource } from './assistantEvidence.ts';
import { reviewRecord, reviewText } from './logReview.ts';

export const PRACTICE_REVIEW_MODE = 'practice-review';
export const PRACTICE_REVIEW_ATTACHMENTS_PER_KIND = 2;
export const PRACTICE_REVIEW_GOAL_LIMIT = 100;

export interface PracticeReviewRequest {
  mode: typeof PRACTICE_REVIEW_MODE;
  sources: EvidenceSource[];
}

export interface PracticeReviewResult {
  approach?: EvidenceFinding;
  verification?: EvidenceFinding;
  missing: string;
  nextStep: string;
}

export function readPracticeReviewRequest(value: unknown): PracticeReviewRequest {
  if (!reviewRecord(value) || value.mode !== PRACTICE_REVIEW_MODE || !Array.isArray(value.sources)
    || !value.sources.length || value.sources.length > 1 + 3 * PRACTICE_REVIEW_ATTACHMENTS_PER_KIND) {
    throw new Error('请选择一次实践进行复盘。');
  }
  const sources = value.sources.map((item, index) => {
    const source = readEvidenceSource(item);
    if (!source || (index === 0) !== (source.kind === 'practice')) {
      throw new Error('复盘资料格式不正确，请重新选择实践。');
    }
    return source;
  });
  if (!sources.some(({ excerpt }) => excerpt.trim())) throw new Error('请先补充实践备注或关联资料。');
  return { mode: PRACTICE_REVIEW_MODE, sources };
}

export function readPracticeReviewResult(value: unknown, sources: EvidenceSource[]): PracticeReviewResult {
  const message = '模型没有返回可核对的复盘，请重试。';
  if (!reviewRecord(value)) throw new Error(message);
  const approach = readEvidenceFinding(value.approach, sources);
  const observed = readEvidenceFinding(value.verification, sources);
  const observedIn = observed && sources[observed.source - 1].kind;
  const verification = observedIn === 'practice' || observedIn === 'log' ? observed : undefined;
  const missing = reviewText(value.missing, 200);
  const nextStep = reviewText(value.nextStep, PRACTICE_REVIEW_GOAL_LIMIT);
  if (!approach && !verification && !missing && !nextStep) throw new Error(message);
  return { approach, verification, missing, nextStep };
}
