import { useGrowthStore } from '../store/growthStore';
import { useKnowledgeStore } from '../store/knowledgeStore';
import { useProjectCodeStore } from '../store/projectCodeStore';
import { useStudyLogStore } from '../store/studyLogStore';
import { GROWTH_SUGGESTIONS_ENDPOINT, readGrowthSuggestions } from '../types/growthSuggestions';
import type { GrowthSuggestionRequest, GrowthSourceKind } from '../types/growthSuggestions';
import type { StudyLog } from '../types';
import { reviewRecord, reviewText } from '../types/logReview';
import { logLabel } from './growth';
import { codeVersionHref } from './projectCode';
import { normalizedName } from './knowledge';
import { searchWords } from './resourceSearch';
import { evidenceExcerpt, RECENT_STUDY_LOG_COUNT, recentLogExcerpts } from './assistantEvidence';
import { isEmptyLogContent } from './studyLogs';

interface Source { id: string; kind: GrowthSourceKind; title: string; excerpt: string; href: string; updated: number }
const logSource = (log: StudyLog, excerpt: string): Source => ({
  id: log.id, kind: 'log', title: logLabel(log), excerpt, href: '#history/' + encodeURIComponent(log.date), updated: log.updatedAt,
});

async function matchingGrowthSources(focus: string, signal: AbortSignal) {
  await useProjectCodeStore.getState().load();
  signal.throwIfAborted();
  const { logs } = useStudyLogStore.getState();
  const { entries } = useKnowledgeStore.getState();
  const { data } = useProjectCodeStore.getState();
  const titles = new Map(data.projects.map((item) => [item.id, item.name]));
  const words = searchWords(focus);
  const sources: Source[] = [
    ...logs.filter((log) => !isEmptyLogContent(log.content, log.date)).map((log) => logSource(log, evidenceExcerpt(log.content, [], 480))),
    ...entries.map((item): Source => ({ id: item.id, kind: 'entry', title: item.title, excerpt: [item.category, ...item.aliases, item.content].join(' · ').slice(0, 480),
      href: '#knowledge/' + encodeURIComponent(item.id), updated: item.updatedAt })),
    ...data.versions.map((item): Source => ({ id: item.id, kind: 'code', title: `${titles.get(item.projectId) ?? ''} · ${item.path}`, excerpt: item.note.slice(0, 480),
      href: codeVersionHref(item.id), updated: item.savedAt })),
  ];
  const ordered = sources.map((source) => {
    const text = normalizedName(source.title + ' ' + source.excerpt);
    return { source, score: words.filter((word) => text.includes(word)).length };
  }).sort((a, b) => b.score - a.score || b.source.updated - a.source.updated);
  const limitByKind = new Map<GrowthSourceKind, number>();
  return ordered.flatMap(({ source }) => {
    const count = limitByKind.get(source.kind) ?? 0;
    if (count >= 4) return [];
    limitByKind.set(source.kind, count + 1);
    return [source];
  });
}

export async function suggestGrowth(focus: string, previous: string[], signal: AbortSignal, recentLogs = false) {
  const selected = recentLogs
    ? recentLogExcerpts(useStudyLogStore.getState().logs, RECENT_STUDY_LOG_COUNT, 480).map(({ log, excerpt }) => logSource(log, excerpt))
    : await matchingGrowthSources(focus, signal);
  signal.throwIfAborted();
  if (!selected.length) return { suggestions: [], sources: selected, unavailable: true };
  const { outcomes, exercises } = useGrowthStore.getState();
  const request: GrowthSuggestionRequest = {
    focus, exclude: [...new Set([...previous, ...[...outcomes, ...exercises].map((item) => item.title)])].slice(0, 20).map((title) => title.slice(0, 80)),
    sources: selected.map(({ kind, title, excerpt }) => ({ kind, title: title.slice(0, 200), excerpt })),
  };
  const response = await fetch(GROWTH_SUGGESTIONS_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error((reviewRecord(value) && reviewText(value.error, 300)) || '暂时无法生成练习建议，请重试。');
  return { suggestions: readGrowthSuggestions(value, request), sources: selected, unavailable: false };
}
