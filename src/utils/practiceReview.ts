import type { GrowthOutcome, GrowthPractice, KnowledgeEntry, StudyLog } from '../types';
import type { CodeProject, CodeVersion, ProjectCodeData } from '../types/projectCode';
import { practiceHref } from '../store/workspaceStore';
import { ASSISTANT_CHAT_ENDPOINT } from '../types/assistantChat';
import { reviewRecord, reviewText } from '../types/logReview';
import { PRACTICE_REVIEW_ATTACHMENTS_PER_KIND, PRACTICE_REVIEW_MODE, readPracticeReviewResult } from '../types/practiceReview';
import type { PracticeReviewRequest } from '../types/practiceReview';
import { codeEvidence, evidenceExcerpt, evidencePayload } from './assistantEvidence';
import type { EvidenceLink } from './assistantEvidence';
import { logLabel } from './growth';
import { practiceCodeIds } from './projectCode';

export interface PracticeSelection { outcomeId: string; practiceId: string }

interface PracticeWithSources {
  outcome: GrowthOutcome;
  practice: GrowthPractice;
  href: string;
  relatedLogs: StudyLog[];
  relatedEntries: KnowledgeEntry[];
  relatedCode: CodeVersion[];
}

export function practiceSourceLookup(logs: StudyLog[], entries: KnowledgeEntry[], code: ProjectCodeData) {
  const logsById = new Map(logs.map((log) => [log.id, log]));
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const versionsById = new Map(code.versions.map((version) => [version.id, version]));
  return (outcome: GrowthOutcome, practice: GrowthPractice): PracticeWithSources => ({
    outcome, practice, href: practiceHref(outcome.id, practice.id),
    relatedLogs: practice.logIds.flatMap((id) => logsById.get(id) ?? []),
    relatedEntries: practice.entryIds.flatMap((id) => entriesById.get(id) ?? []),
    relatedCode: practiceCodeIds(outcome.id, practice, code.links).flatMap((id) => versionsById.get(id) ?? []),
  });
}

export function practiceReviewSources({ outcome, practice, href, relatedLogs, relatedEntries, relatedCode }: PracticeWithSources,
  words: string[], projects: CodeProject[]): EvidenceLink[] {
  const limit = PRACTICE_REVIEW_ATTACHMENTS_PER_KIND;
  const logSources = relatedLogs.filter((log) => log.content.trim() !== `### ${log.date}`).map((log): EvidenceLink => ({
    kind: 'log', title: logLabel(log), href: '#history/' + log.date, excerpt: evidenceExcerpt(log.content, words),
  })).filter(({ excerpt }) => excerpt).slice(0, limit);
  const entrySources = relatedEntries.map((entry): EvidenceLink => ({
    kind: 'entry', title: entry.title, href: '#knowledge/' + encodeURIComponent(entry.id), excerpt: evidenceExcerpt(entry.content, words),
  })).filter(({ excerpt }) => excerpt).slice(0, limit);
  const codeSources = relatedCode.filter(({ content, note }) => content?.trim() || note.trim()).slice(0, limit)
    .map((version) => codeEvidence(version, projects.find(({ id }) => id === version.projectId)?.name, words))
    .filter(({ excerpt }) => excerpt);
  return [{ kind: 'practice', title: `${practice.date} · ${outcome.title}`, excerpt: evidenceExcerpt(practice.note, words), href },
    ...logSources, ...entrySources, ...codeSources];
}

export async function requestPracticeReview(links: EvidenceLink[], signal: AbortSignal) {
  const sources = evidencePayload(links);
  const input: PracticeReviewRequest = { mode: PRACTICE_REVIEW_MODE, sources };
  const response = await fetch(ASSISTANT_CHAT_ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
  });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((reviewRecord(value) && reviewText(value.error, 300)) || '暂时无法复盘，请重试。');
  }
  return readPracticeReviewResult(value, sources);
}
