import type { KnowledgeEntry, KnowledgeLogLink, KnowledgeRelation, StoredKnowledgeData, TrashedKnowledgeEntry } from '../types/index.ts';
import { isRelationAnnotation } from './relationAnnotation.ts';

export const emptyKnowledgeTrash = (): StoredKnowledgeData['trash'] => ({ entries: [], logLinks: [], relations: [] });
export const emptyKnowledge = (): StoredKnowledgeData => ({ version: 1, entries: [], logLinks: [], relations: [], trash: emptyKnowledgeTrash() });
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
function trashedEntry(value: unknown): value is TrashedKnowledgeEntry {
  return record(value) && timestamp(value.deletedAt) && Number.isFinite(new Date(value.deletedAt).getTime()) && entry(value);
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

export function validateKnowledge(value: unknown, logIds?: Set<string>): StoredKnowledgeData {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.entries) || !value.entries.every(entry)
    || !Array.isArray(value.logLinks) || !value.logLinks.every(link) || !Array.isArray(value.relations) || !value.relations.every(relation)) {
    throw new Error('知识词条数据格式不正确，未修改现有数据。');
  }
  const entries: KnowledgeEntry[] = value.entries;
  const logLinks: KnowledgeLogLink[] = value.logLinks;
  const relations: KnowledgeRelation[] = value.relations;
  const rawTrash = value.trash === undefined ? emptyKnowledgeTrash() : value.trash;
  if (!record(rawTrash) || !Array.isArray(rawTrash.entries) || !rawTrash.entries.every(trashedEntry)
    || !Array.isArray(rawTrash.logLinks) || !rawTrash.logLinks.every(link)
    || !Array.isArray(rawTrash.relations) || !rawTrash.relations.every(relation)) throw new Error('词条回收站数据格式不正确。');
  const trash: StoredKnowledgeData['trash'] = { entries: rawTrash.entries, logLinks: rawTrash.logLinks, relations: rawTrash.relations };
  const ids = new Set(entries.map((item) => item.id));
  const trashedIds = new Set(trash.entries.map((item) => item.id));
  const allIds = new Set([...ids, ...trashedIds]);
  const names = new Set<string>();
  for (const item of entries) {
    for (const name of entryNames(item)) {
      if (names.has(name)) throw new Error('词条名称或别名重复，请选择已有词条或调整名称。');
      names.add(name);
    }
  }
  if (allIds.size !== entries.length + trash.entries.length
    || new Set([...logLinks, ...trash.logLinks].map((item) => item.id)).size !== logLinks.length + trash.logLinks.length
    || new Set([...relations, ...trash.relations].map((item) => item.id)).size !== relations.length + trash.relations.length) {
    throw new Error('知识数据存在重复 ID。');
  }
  if (trash.logLinks.some((item) => !trashedIds.has(item.entryId))
    || trash.relations.some(({ sourceId, targetId }) => (!trashedIds.has(sourceId) && !trashedIds.has(targetId))
      || !allIds.has(sourceId) || !allIds.has(targetId))) throw new Error('回收站的词条关联无效。');
  const pairs = new Set<string>();
  if (logLinks.some((item) => !ids.has(item.entryId))
    || [...logLinks, ...trash.logLinks].some((item) => logIds && !logIds.has(item.logId))) {
    throw new Error('词条关联指向了不存在的词条或学习记录。');
  }
  for (const item of [...logLinks, ...trash.logLinks]) {
    const pair = JSON.stringify([item.entryId, item.logId]);
    if (pairs.has(pair)) throw new Error('学习记录与词条的关联重复。');
    pairs.add(pair);
  }
  const relatedPairs = new Set<string>();
  if (relations.some(({ sourceId, targetId }) => !ids.has(sourceId) || !ids.has(targetId))) throw new Error('相关词条指向了不存在的词条。');
  for (const item of [...relations, ...trash.relations]) {
    const pair = JSON.stringify([item.sourceId, item.targetId].sort());
    if (relatedPairs.has(pair)) throw new Error('相关词条关系重复。');
    relatedPairs.add(pair);
  }
  return { version: 1, entries, logLinks, relations, trash };
}
