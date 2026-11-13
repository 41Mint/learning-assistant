import { useKnowledgeStore } from '../store/knowledgeStore';
import { useProjectCodeStore } from '../store/projectCodeStore';
import { useStudyLogStore } from '../store/studyLogStore';
import { LOG_REVIEW_ENDPOINT, LOG_REVIEW_MAX_TEXT, readReviewQueries, readReviewResult, reviewRecord, reviewText } from '../types/logReview';
import type { LogReviewContext, LogReviewRequest, LogReviewSuggestion } from '../types/logReview';
import { entryNames, normalizedName } from './knowledge';
import { buildRelationGraph, relationLabel } from './relations';
import { entrySearchFields, matchesWords, searchWords } from './resourceSearch';

async function requestReview(body: LogReviewRequest, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(LOG_REVIEW_ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
  });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok || value === null) {
    const message = reviewRecord(value) ? reviewText(value.error, 300) : '';
    throw new Error(message || '整理服务不可用。请在本机启动学习助手后重试。');
  }
  return value;
}

async function queryLogResources(logId: string, queries: string[]): Promise<LogReviewContext> {
  useKnowledgeStore.getState().loadKnowledge();
  await useProjectCodeStore.getState().load();
  const knowledge = useKnowledgeStore.getState();
  if (knowledge.error) throw new Error(knowledge.error);
  const { logs } = useStudyLogStore.getState();
  const code = useProjectCodeStore.getState().data;
  const log = logs.find((item) => item.id === logId);
  const graph = buildRelationGraph({ kind: 'log', id: logId }, logs, knowledge, code);
  const linked = new Set(graph.edges.filter(({ node }) => node.kind === 'entry').map(({ node }) => node.id));
  const words = queries.map(searchWords).filter((query) => query.length);
  const entries = knowledge.entries
    .map((entry) => ({
      entry,
      score: Number(linked.has(entry.id)) + words.reduce((score, query) => score
        + (matchesWords([entry.title, ...entry.aliases], query) ? 3 : Number(matchesWords(entrySearchFields(entry), query))), 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(({ entry }) => ({
      id: entry.id, title: entry.title.slice(0, 100), aliases: entry.aliases.slice(0, 8).map((alias) => alias.slice(0, 80)),
      category: entry.category.slice(0, 80),
    }));
  return {
    entries,
    related: graph.edges.slice(0, 12).map(({ node, ...edge }) => ({
      title: node.title.slice(0, 160), kind: node.kind, label: relationLabel(edge).slice(0, 80),
    })),
    tags: (log?.tags ?? []).slice(0, 20).map((tag) => tag.slice(0, 40)),
    categories: [...new Set(knowledge.entries.map(({ category }) => category.slice(0, 80)).filter(Boolean))].slice(0, 40),
  };
}

export async function organizeLog(logId: string, content: string, focus: string, signal: AbortSignal, onSearching: () => void) {
  const text = content.slice(0, LOG_REVIEW_MAX_TEXT);
  const queries = readReviewQueries(await requestReview({ stage: 'plan', text, focus }, signal));
  onSearching();
  const context = await queryLogResources(logId, queries);
  signal.throwIfAborted();
  const result = readReviewResult(await requestReview({ stage: 'suggest', text, focus, context }, signal));
  const candidates = new Set(context.entries.map(({ id }) => id));
  const current = useKnowledgeStore.getState();
  const byName = new Map(current.entries.flatMap((entry) => entryNames(entry).map((name) => [name, entry.id] as const)));
  const linked = new Set(current.logLinks.filter((link) => link.logId === logId).map((link) => link.entryId));
  const log = useStudyLogStore.getState().logs.find(({ id }) => id === logId);
  const used = new Set((log?.tags ?? []).map((tag) => 'tag:' + normalizedName(tag)));
  const suggestions: LogReviewSuggestion[] = [];
  for (const item of result.suggestions) {
    if (!text.includes(item.evidence)) continue;
    const existing = item.kind === 'entry' ? byName.get(normalizedName(item.title)) : undefined;
    const suggestion: LogReviewSuggestion = existing
      ? { kind: 'link', entryId: existing, evidence: item.evidence, note: '' }
      : item;
    if (suggestion.kind === 'link' && (linked.has(suggestion.entryId)
      || (!existing && !candidates.has(suggestion.entryId))
      || !current.entries.some(({ id }) => id === suggestion.entryId))) continue;
    const key = suggestion.kind === 'link' ? 'link:' + suggestion.entryId
      : suggestion.kind === 'tag' ? 'tag:' + normalizedName(suggestion.tag) : 'entry:' + normalizedName(suggestion.title);
    if (used.has(key)) continue;
    used.add(key);
    suggestions.push(suggestion);
  }
  return { suggestions, summary: result.summary, queries, context };
}
