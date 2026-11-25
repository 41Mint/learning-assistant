import { EVIDENCE_EXCERPT_LIMIT, EVIDENCE_TITLE_LIMIT } from '../types/assistantEvidence';
import type { EvidenceSource } from '../types/assistantEvidence';
import type { CodeVersion } from '../types/projectCode';
import type { StudyLog } from '../types';
import { lineLabel, scriptLines } from './assistantCode';
import { codeCitationHref } from './codeCitation';
import { codeVersionHref, codeVersionLabel } from './projectCode';
import { matchScriptLine, textMatches } from './searchMatches';
import { getTodayDate } from './storage';
import { isEmptyLogContent } from './studyLogs';

export interface EvidenceLink extends EvidenceSource { href: string }
export const RECENT_STUDY_LOG_COUNT = 3;

export const evidenceLabels = { practice: '实践', log: '日志', entry: '词条', code: '代码' } satisfies Record<EvidenceSource['kind'], string>;

export function evidenceExcerpt(text: string, words: string[], limit = EVIDENCE_EXCERPT_LIMIT) {
  const content = text.replace(/!\[[^\]]*\]\([^\n]*?\)/g, '').trim();
  const [match] = textMatches(content, words, true);
  const start = match ? Math.max(0, match.start - Math.floor(limit / 4)) : 0;
  return content.slice(start, start + limit).trim();
}

export function recentLogExcerpts(logs: StudyLog[], count: number, excerptLimit?: number) {
  const today = getTodayDate();
  const recent: { log: StudyLog; excerpt: string }[] = [];
  for (const log of logs.toSorted((a, b) => b.date.localeCompare(a.date))) {
    if (log.date > today) continue;
    const excerpt = evidenceExcerpt(log.content, [], excerptLimit);
    if (isEmptyLogContent(excerpt, log.date)) continue;
    recent.push({ log, excerpt });
    if (recent.length >= count) break;
  }
  return recent;
}

export function codeEvidence(version: CodeVersion, project: string | undefined, words: string[]): EvidenceLink {
  const hit = version.content ? matchScriptLine(version.content, words) : undefined;
  const startLine = Math.max(1, (hit?.line ?? 1) - 2);
  const lines = scriptLines(version.content ?? '');
  const snippet = lines.slice(startLine - 1, startLine + 9).join('\n').slice(0, 850).trimEnd();
  const endLine = startLine + snippet.split('\n').length - 1;
  const note = evidenceExcerpt(version.note, words, 250);
  const range = snippet ? lineLabel({ startLine, endLine }) : '';
  return {
    kind: 'code',
    title: [codeVersionLabel(version, project), range].filter(Boolean).join(' · '),
    excerpt: [note, snippet && `代码片段（${range}）\n${snippet}`].filter(Boolean).join('\n\n'),
    href: snippet ? codeCitationHref(version.id, { startLine, endLine }) : codeVersionHref(version.id),
  };
}

export function evidencePayload(links: EvidenceLink[]): EvidenceSource[] {
  return links.map(({ kind, title, excerpt }) => ({
    kind, title: title.slice(0, EVIDENCE_TITLE_LIMIT), excerpt: excerpt.slice(0, EVIDENCE_EXCERPT_LIMIT),
  }));
}
