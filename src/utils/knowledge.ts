import type { KnowledgeData, KnowledgeEntry, KnowledgeLogLink, KnowledgeRelation } from '../types';
import { isRelationAnnotation } from './relationAnnotation';

export const emptyKnowledge = (): KnowledgeData => ({ version: 1, entries: [], logLinks: [], relations: [] });
export const normalizedName = (name: string) => name.normalize('NFKC').trim().toLocaleLowerCase();
export const entryNames = (entry: Pick<KnowledgeEntry, 'title' | 'aliases'>) => [entry.title, ...entry.aliases].map(normalizedName);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function identifier(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function timestamp(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
function entry(value: unknown): value is KnowledgeEntry {
  if (!(record(value) && identifier(value.id) && identifier(value.title) && Array.isArray(value.aliases)
    && value.aliases.every(identifier) && typeof value.category === 'string' && typeof value.content === 'string'
    && timestamp(value.createdAt) && timestamp(value.updatedAt)
    && (value.codeVersionIds === undefined || Array.isArray(value.codeVersionIds)
      && value.codeVersionIds.every(identifier) && new Set(value.codeVersionIds).size === value.codeVersionIds.length))) return false;
  const versionIds = new Set(Array.isArray(value.codeVersionIds) ? value.codeVersionIds : []);
  const annotations = value.codeAnnotations;
  return annotations === undefined || Array.isArray(annotations)
    && annotations.every((item) => record(item) && identifier(item.versionId) && versionIds.has(item.versionId) && isRelationAnnotation(item.annotation))
    && new Set(annotations.map((item) => item.versionId)).size === annotations.length;
}
function link(value: unknown): value is KnowledgeLogLink {
  return record(value) && identifier(value.id) && identifier(value.entryId) && identifier(value.logId) && typeof value.note === 'string'
    && (value.annotation === undefined || isRelationAnnotation(value.annotation));
}
function relation(value: unknown): value is KnowledgeRelation {
  return record(value) && identifier(value.id) && identifier(value.sourceId) && identifier(value.targetId) && value.sourceId !== value.targetId
    && (value.annotation === undefined || isRelationAnnotation(value.annotation));
}

export function otherEntryId(relation: KnowledgeRelation, entryId: string): string | undefined {
  if (relation.sourceId === entryId) return relation.targetId;
  if (relation.targetId === entryId) return relation.sourceId;
}

export function validateKnowledge(value: unknown, logIds?: Set<string>): KnowledgeData {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.entries) || !value.entries.every(entry)
    || !Array.isArray(value.logLinks) || !value.logLinks.every(link) || !Array.isArray(value.relations) || !value.relations.every(relation)) {
    throw new Error('知识词条数据格式不正确，未修改现有数据。');
  }
  const entries: KnowledgeEntry[] = value.entries;
  const logLinks: KnowledgeLogLink[] = value.logLinks;
  const relations: KnowledgeRelation[] = value.relations;
  const ids = new Set(entries.map((item) => item.id));
  const names = new Set<string>();
  for (const item of entries) {
    for (const name of entryNames(item)) {
      if (names.has(name)) throw new Error('词条名称或别名重复，请选择已有词条或调整名称。');
      names.add(name);
    }
  }
  if (ids.size !== entries.length || new Set(logLinks.map((item) => item.id)).size !== logLinks.length
    || new Set(relations.map((item) => item.id)).size !== relations.length) throw new Error('知识数据存在重复 ID。');
  const pairs = new Set<string>();
  for (const item of logLinks) {
    if (!ids.has(item.entryId) || logIds && !logIds.has(item.logId)) throw new Error('词条关联指向了不存在的词条或学习记录。');
    const pair = JSON.stringify([item.entryId, item.logId]);
    if (pairs.has(pair)) throw new Error('学习记录与词条的关联重复。');
    pairs.add(pair);
  }
  const relatedPairs = new Set<string>();
  for (const item of relations) {
    if (!ids.has(item.sourceId) || !ids.has(item.targetId)) throw new Error('相关词条指向了不存在的词条。');
    const pair = JSON.stringify([item.sourceId, item.targetId].sort());
    if (relatedPairs.has(pair)) throw new Error('相关词条关系重复。');
    relatedPairs.add(pair);
  }
  return { version: 1, entries, logLinks, relations };
}
