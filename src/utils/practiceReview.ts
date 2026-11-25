import type { GrowthOutcome, GrowthPractice, KnowledgeEntry, StudyLog } from '../types';
import type { CodeProject, CodeVersion } from '../types/projectCode';
import { ASSISTANT_CHAT_ENDPOINT } from '../types/assistantChat';
import { reviewRecord, reviewText } from '../types/logReview';
import { PRACTICE_REVIEW_ATTACHMENTS_PER_KIND, PRACTICE_REVIEW_EXCERPT_LIMIT, PRACTICE_REVIEW_MODE, PRACTICE_REVIEW_TITLE_LIMIT,
  readPracticeReviewResult } from '../types/practiceReview';
import type { PracticeReviewRequest, PracticeReviewSource } from '../types/practiceReview';
import { codeCitationHref } from './codeCitation';
import { logLabel } from './growth';
import { codeVersionHref, codeVersionLabel } from './projectCode';
import { matchScriptLine, textMatches } from './searchMatches';

export interface PracticeReviewLink extends PracticeReviewSource { href: string }

interface PracticeWithSources {
  outcome: GrowthOutcome;
  practice: GrowthPractice;
  href: string;
  relatedLogs: StudyLog[];
  relatedEntries: KnowledgeEntry[];
  relatedCode: CodeVersion[];
}

function textExcerpt(text: string, words: string[], limit = PRACTICE_REVIEW_EXCERPT_LIMIT) {
  const content = text.replace(/!\[[^\]]*\]\([^\n]*?\)/g, '').trim();
  const [match] = textMatches(content, words, true);
  const start = match ? Math.max(0, match.start - Math.floor(limit / 4)) : 0;
  return content.slice(start, start + limit).trim();
}

function codeExcerpt(version: CodeVersion, project: string | undefined, words: string[]): PracticeReviewLink {
  const hit = version.content ? matchScriptLine(version.content, words) : undefined;
  const startLine = Math.max(1, (hit?.line ?? 1) - 2);
  const lines = version.content?.split(/\r\n|\r|\n/) ?? [];
  const snippet = lines.slice(startLine - 1, startLine + 9).join('\n').slice(0, 850).trimEnd();
  const endLine = startLine + snippet.split('\n').length - 1;
  const note = textExcerpt(version.note, words, 250);
  const range = snippet ? `第 ${startLine}–${endLine} 行` : '';
  return {
    kind: 'code',
    title: [codeVersionLabel(version, project), range].filter(Boolean).join(' · '),
    excerpt: [note, snippet && `代码片段（${range}）\n${snippet}`].filter(Boolean).join('\n\n'),
    href: snippet ? codeCitationHref(version.id, { startLine, endLine }) : codeVersionHref(version.id),
  };
}

export function practiceReviewSources({ outcome, practice, href, relatedLogs, relatedEntries, relatedCode }: PracticeWithSources,
  words: string[], projects: CodeProject[]): PracticeReviewLink[] {
  const limit = PRACTICE_REVIEW_ATTACHMENTS_PER_KIND;
  const logSources = relatedLogs.filter((log) => log.content.trim() !== `### ${log.date}`).map((log): PracticeReviewLink => ({
    kind: 'log', title: logLabel(log), href: '#history/' + log.date, excerpt: textExcerpt(log.content, words),
  })).filter(({ excerpt }) => excerpt).slice(0, limit);
  const entrySources = relatedEntries.map((entry): PracticeReviewLink => ({
    kind: 'entry', title: entry.title, href: '#knowledge/' + encodeURIComponent(entry.id), excerpt: textExcerpt(entry.content, words),
  })).filter(({ excerpt }) => excerpt).slice(0, limit);
  const codeSources = relatedCode.filter(({ content, note }) => content?.trim() || note.trim()).slice(0, limit)
    .map((version) => codeExcerpt(version, projects.find(({ id }) => id === version.projectId)?.name, words))
    .filter(({ excerpt }) => excerpt);
  return [{ kind: 'practice', title: `${practice.date} · ${outcome.title}`, excerpt: textExcerpt(practice.note, words), href },
    ...logSources, ...entrySources, ...codeSources];
}

export async function requestPracticeReview(links: PracticeReviewLink[], signal: AbortSignal) {
  const sources = links.map(({ kind, title, excerpt }) => ({
    kind, title: title.slice(0, PRACTICE_REVIEW_TITLE_LIMIT), excerpt: excerpt.slice(0, PRACTICE_REVIEW_EXCERPT_LIMIT),
  }));
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
