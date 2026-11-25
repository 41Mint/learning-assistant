import { CHAT_QUESTION_LIMIT } from './assistantChat.ts';
import { readEvidenceFinding, readEvidenceSource } from './assistantEvidence.ts';
import type { EvidenceFinding, EvidenceSource } from './assistantEvidence.ts';
import { readReviewQueries, reviewRecord, reviewText } from './logReview.ts';

export const RESOURCE_ANSWER_MODE = 'resource-answer';
export const RESOURCE_ANSWER_SOURCE_LIMIT = 6;
export const RESOURCE_ANSWER_FINDING_LIMIT = 4;

export type ResourceAnswerRequest = { mode: typeof RESOURCE_ANSWER_MODE; question: string } &
  ({ stage: 'plan' } | { stage: 'answer'; sources: EvidenceSource[] });

export interface ResourceAnswerResult {
  findings: EvidenceFinding[];
  missing: string;
}

export function readResourceAnswerQueries(value: unknown) {
  if (!reviewRecord(value) || !Array.isArray(value.queries)) throw new Error('模型没有返回可用的检索词，请重试。');
  return readReviewQueries(value);
}

export function readResourceAnswerRequest(value: unknown): ResourceAnswerRequest {
  const message = '资料问答请求格式无效。';
  if (!reviewRecord(value) || value.mode !== RESOURCE_ANSWER_MODE || typeof value.question !== 'string'
    || !value.question.trim() || value.question.length > CHAT_QUESTION_LIMIT) throw new Error(message);
  const question = value.question.trim();
  if (value.stage === 'plan') return { mode: RESOURCE_ANSWER_MODE, stage: 'plan', question };
  if (value.stage !== 'answer' || !Array.isArray(value.sources)
    || !value.sources.length || value.sources.length > RESOURCE_ANSWER_SOURCE_LIMIT) throw new Error(message);
  const sources = value.sources.map((value) => {
    const source = readEvidenceSource(value);
    if (!source?.excerpt.trim()) throw new Error(message);
    return source;
  });
  return { mode: RESOURCE_ANSWER_MODE, stage: 'answer', question, sources };
}

export function readResourceAnswerResult(value: unknown, sources: EvidenceSource[]): ResourceAnswerResult {
  const message = '模型没有返回可核对的资料回答，请重试。';
  if (!reviewRecord(value) || !Array.isArray(value.findings) || value.findings.length > RESOURCE_ANSWER_FINDING_LIMIT) throw new Error(message);
  const findings = value.findings.map((item) => {
    const finding = readEvidenceFinding(item, sources);
    if (!finding) throw new Error(message);
    return finding;
  });
  const missing = reviewText(value.missing, 220);
  if (!findings.length && !missing) throw new Error(message);
  return { findings, missing };
}
