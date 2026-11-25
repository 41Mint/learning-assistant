import { useStudyLogStore } from '../store/studyLogStore';
import type { SearchRecord, SearchResultSet } from './resourceSearch';
import { ASSISTANT_CHAT_ENDPOINT } from '../types/assistantChat';
import { reviewRecord, reviewText } from '../types/logReview';
import { RESOURCE_ANSWER_MODE, RESOURCE_ANSWER_SOURCE_LIMIT, readResourceAnswerQueries, readResourceAnswerResult } from '../types/resourceAnswer';
import type { ResourceAnswerRequest, ResourceAnswerResult } from '../types/resourceAnswer';
import { codeEvidence, evidenceExcerpt, evidencePayload, recentLogExcerpts } from './assistantEvidence';
import type { EvidenceLink } from './assistantEvidence';
import { normalizedName } from './knowledge';
import { logLabel } from './growth';

export interface ResourceAnswer {
  sources: EvidenceLink[];
  result?: ResourceAnswerResult;
  filter?: { label: string; count: number };
  recentDates?: string[];
}

export interface ResourceQuestionContext {
  results: SearchResultSet;
  filterLabel?: string;
}

function rankRecords(records: SearchRecord[], words: string[]) {
  return records.map((record) => {
    const title = normalizedName(record.title);
    const body = record.evidence?.kind === 'code' ? record.source : record.evidence?.text;
    const content = normalizedName(body ?? '');
    const metadata = normalizedName(record.fields.join('\n'));
    const score = words.reduce((total, word) => total + (title.includes(word) ? 3
      : content.includes(word) ? 2 : Number(metadata.includes(word))), 0);
    return { record, score };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).map(({ record }) => record);
}

function selectEvidence(records: SearchRecord[], words: string[]) {
  const sources: EvidenceLink[] = [];
  for (const { evidence, title, href } of records) {
    if (!evidence) continue;
    const source = evidence.kind === 'code' ? codeEvidence(evidence.version, evidence.projectName, words)
      : { kind: evidence.kind, title, href, excerpt: evidenceExcerpt(evidence.text, words) };
    if (source.excerpt) sources.push(source);
    if (sources.length === RESOURCE_ANSWER_SOURCE_LIMIT) break;
  }
  return sources;
}

async function requestAnswer(input: ResourceAnswerRequest, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(ASSISTANT_CHAT_ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
  });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((reviewRecord(value) && reviewText(value.error, 300)) || '资料问答暂时不可用，请重试。');
  }
  return value;
}

async function answerWithSources(question: string, sources: EvidenceLink[], signal: AbortSignal): Promise<ResourceAnswer> {
  if (!sources.length) return { sources };
  const payload = evidencePayload(sources);
  const result = readResourceAnswerResult(await requestAnswer({ mode: RESOURCE_ANSWER_MODE, question, stage: 'answer', sources: payload }, signal), payload);
  return { sources, result };
}

export async function summarizeRecentLogs(question: string, count: number, signal: AbortSignal): Promise<ResourceAnswer> {
  const { logs, error } = useStudyLogStore.getState();
  if (error) throw new Error(error);
  const recent = recentLogExcerpts(logs, count);
  const sources = recent.map(({ log, excerpt }): EvidenceLink => ({
    kind: 'log', title: logLabel(log), href: '#history/' + encodeURIComponent(log.date), excerpt,
  }));
  const answer = await answerWithSources(question, sources, signal);
  return { ...answer, recentDates: recent.map(({ log }) => log.date) };
}

export async function answerFromResources(question: string, { results, filterLabel }: ResourceQuestionContext, signal: AbortSignal): Promise<ResourceAnswer> {
  const request = { mode: RESOURCE_ANSWER_MODE, question } as const;
  let candidates = results.groups.flatMap(({ items }) => items);
  let words = results.words;
  const filter = filterLabel === undefined ? undefined : { label: filterLabel, count: results.count };
  if (filter) {
    // Give each result category a chance to contribute to an overview of the current results.
    candidates = results.groups.flatMap(({ items }) => items.slice(0, RESOURCE_ANSWER_SOURCE_LIMIT).map((record, index) => ({ record, index })))
      .sort((a, b) => a.index - b.index).map(({ record }) => record);
  } else if (candidates.some(({ evidence }) => evidence)) {
    const queries = readResourceAnswerQueries(await requestAnswer({ ...request, stage: 'plan' }, signal));
    signal.throwIfAborted();
    const literal = question.replace(/[。！？!?]+$/u, '');
    words = [...new Set([...queries, literal].map(normalizedName).filter(Boolean))];
    candidates = rankRecords(candidates, words);
  }
  const answer = await answerWithSources(question, selectEvidence(candidates, words), signal);
  return { ...answer, filter };
}
