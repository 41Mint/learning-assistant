import type { KnowledgeData, KnowledgeEntry, KnowledgeLogLink, KnowledgeRelation } from '../types';

export const emptyKnowledge = (): KnowledgeData => ({ version: 1, entries: [], logLinks: [], relations: [] });
export const normalizedName = (name: string) => name.normalize('NFKC').trim().toLocaleLowerCase();
export const entryNames = (entry: Pick<KnowledgeEntry, 'title' | 'aliases'>) => [entry.title, ...entry.aliases].map(normalizedName);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function identifier(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function timestamp(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
function entry(value: unknown): value is KnowledgeEntry {
  return record(value) && identifier(value.id) && identifier(value.title) && Array.isArray(value.aliases)
    && value.aliases.every(identifier) && typeof value.category === 'string' && typeof value.content === 'string'
    && timestamp(value.createdAt) && timestamp(value.updatedAt);
}
function link(value: unknown): value is KnowledgeLogLink {
  return record(value) && identifier(value.id) && identifier(value.entryId) && identifier(value.logId) && typeof value.note === 'string';
}
function relation(value: unknown): value is KnowledgeRelation {
  return record(value) && identifier(value.id) && identifier(value.sourceId) && identifier(value.targetId) && value.sourceId !== value.targetId;
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
