import type { KnowledgeEntry, StudyLog } from '../types';
import type { CodeVersion } from '../types/projectCode';
import { normalizedName } from './knowledge';

export function searchWords(query: string): string[] {
  return normalizedName(query).split(/\s+/).filter(Boolean);
}

export function matchesWords(fields: string[], words: string[]): boolean {
  if (!words.length) return true;
  const text = normalizedName(fields.join('\n'));
  return words.every((word) => text.includes(word));
}

export function matchExcerpt(fields: string[], words: string[]): string {
  for (const field of fields) {
    const text = field.normalize('NFKC').replace(/\s+/g, ' ').trim();
    const lower = text.toLocaleLowerCase();
    const word = words.find((item) => lower.includes(item));
    if (!word) continue;
    const index = lower.indexOf(word);
    const start = Math.max(0, index - 24);
    const end = Math.min(text.length, Math.max(start + 100, index + word.length));
    return (start ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }
  return '';
}

export function logSearchFields(log: StudyLog): string[] {
  return [log.content, ...log.tags, ...log.knowledgePoints, log.date];
}

export function entrySearchFields(entry: KnowledgeEntry): string[] {
  return [entry.content, ...entry.aliases, entry.category, entry.title];
}

export function codeSearchFields(version: CodeVersion, projectName: string): string[] {
  return [version.note, version.path, projectName];
}
