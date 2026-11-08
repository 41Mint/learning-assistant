import type { KnowledgeEntry, StudyLog } from '../types';
import type { CodeVersion } from '../types/projectCode';
import { normalizedName } from './knowledge';

export function searchWords(query: string): string[] {
  return [...new Set(normalizedName(query).split(/\s+/).filter(Boolean))];
}

export function matchesWords(fields: string[], words: string[]): boolean {
  return !words.length || includesWords(normalizedName(fields.join('\n')), words);
}

export function includesWords(text: string, words: string[]): boolean {
  return words.every((word) => text.includes(word));
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
