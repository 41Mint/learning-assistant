import { reviewRecord, reviewText } from './logReview.ts';

export const GROWTH_SUGGESTIONS_ENDPOINT = '/api/growth-suggestions';
export type GrowthSourceKind = 'log' | 'entry' | 'code';

export interface GrowthSuggestionRequest {
  focus: string;
  exclude: string[];
  sources: { kind: GrowthSourceKind; title: string; excerpt: string }[];
}

export interface GrowthSuggestion {
  title: string;
  action: string;
  done: string;
  sources: number[];
}

export function readGrowthSuggestions(value: unknown, request: GrowthSuggestionRequest): GrowthSuggestion[] {
  if (!reviewRecord(value) || !Array.isArray(value.suggestions)) throw new Error('推荐结果格式有误，请重试。');
  const key = (title: string) => title.normalize('NFKC').trim().toLocaleLowerCase();
  const seen = new Set(request.exclude.map(key));
  return value.suggestions.slice(0, 12).flatMap((item): GrowthSuggestion[] => {
    if (!reviewRecord(item) || !Array.isArray(item.sources)) return [];
    const sources = [...new Set(item.sources.filter((index): index is number =>
      Number.isInteger(index) && index >= 1 && index <= request.sources.length))].slice(0, 3);
    const title = reviewText(item.title, 80);
    const action = reviewText(item.action, 180);
    const done = reviewText(item.done, 180);
    if (!title || !action || !done || !sources.length || seen.has(key(title))) return [];
    seen.add(key(title));
    return [{ title, action, done, sources }];
  }).slice(0, 3);
}
