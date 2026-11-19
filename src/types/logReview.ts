export const LOG_REVIEW_ENDPOINT = '/api/log-review';
export const LOG_REVIEW_MAX_TEXT = 24000;
export const LOG_REVIEW_MAX_SUGGESTIONS = 12;

export type LogReviewSuggestion =
  | { kind: 'tag'; tag: string; evidence: string }
  | { kind: 'link'; entryId: string; note: string; evidence: string }
  | { kind: 'entry'; title: string; category: string; content: string; evidence: string; citationAnchor?: string };

export interface LogReviewContext {
  entries: { id: string; title: string; aliases: string[]; category: string }[];
  related: { title: string; kind: 'entry' | 'code' | 'log'; label: string }[];
  tags: string[];
  categories: string[];
}

export const draftLength = (value: string) => [...value.replace(/\s/gu, '')].length;

export function wantsConciseDrafts(focus: string) {
  return /精简|简化|简短|简洁|压缩|缩短|再短|短一点|太长|冗长|删掉.*废话|不超过\s*\d+\s*字|(?:少于|控制在|压到)\s*\d+\s*字/u.test(focus);
}

export function conciseLimit(focus: string, content: string): number | undefined {
  if (!wantsConciseDrafts(focus)) return;
  const original = draftLength(content);
  const requested = Number(focus.match(/(?:不超过|内|控制在|压到|少于)?\s*(\d{1,4})\s*字/u)?.[1] ?? 0);
  if (requested > 0) return requested;
  // Very short drafts may already be concise; do not force factual omissions.
  if (original < 24) return 24;
  return Math.min(120, Math.floor(original * 0.7));
}

export type LogReviewRequest = { text: string; focus: string } & (
  | { stage: 'plan' }
  | { stage: 'suggest'; context: LogReviewContext }
);

export interface LogReviewResult { suggestions: LogReviewSuggestion[]; summary: string }

export function reviewRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function reviewText(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

export function readReviewQueries(value: unknown): string[] {
  if (!reviewRecord(value) || !Array.isArray(value.queries)) return [];
  return [...new Set(value.queries.map((query) => reviewText(query, 80)).filter(Boolean))].slice(0, 8);
}

export function readReviewResult(value: unknown): LogReviewResult {
  if (!reviewRecord(value) || !Array.isArray(value.suggestions)) {
    throw new Error('模型没有返回可用的整理建议，请重试。');
  }
  const suggestions = value.suggestions.slice(0, LOG_REVIEW_MAX_SUGGESTIONS).flatMap((item): LogReviewSuggestion[] => {
    if (!reviewRecord(item)) return [];
    const evidence = reviewText(item.evidence, 220);
    if (!evidence) return [];
    if (item.kind === 'tag') {
      const tag = reviewText(item.tag, 40);
      return tag ? [{ kind: 'tag', tag, evidence }] : [];
    }
    if (item.kind === 'link') {
      const entryId = reviewText(item.entryId, 160);
      return entryId ? [{ kind: 'link', entryId, note: reviewText(item.note, 300), evidence }] : [];
    }
    if (item.kind === 'entry') {
      const title = reviewText(item.title, 100);
      const content = reviewText(item.content, 1200);
      const citationAnchor = reviewText(item.citationAnchor, 80) || undefined;
      return title && content ? [{ kind: 'entry', title, category: reviewText(item.category, 80), content, evidence, citationAnchor }] : [];
    }
    return [];
  });
  return { suggestions, summary: reviewText(value.summary, 300) };
}
