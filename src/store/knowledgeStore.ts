import { create } from 'zustand';
import type { KnowledgeData, KnowledgeEntry, KnowledgeLogLink, KnowledgeRelation } from '../types';
import type { RelationAnnotation } from '../types/relations';
import type { LogReviewSuggestion } from '../types/logReview';
import { emptyKnowledge, entryNames, normalizedName, otherEntryId, validateKnowledge } from '../utils/knowledge';
import { entryCodeIds } from '../utils/projectCode';
import { cleanRelationAnnotation } from '../utils/relationAnnotation';
import { generateId, STORAGE_KEYS } from '../utils/storage';
import { useStudyLogStore } from './studyLogStore';
import { useProjectCodeStore } from './projectCodeStore';

export type EntryInput = Pick<KnowledgeEntry, 'title' | 'aliases' | 'category' | 'content'>;
interface EntrySaveOptions {
  id?: string;
  fromLog?: { id: string; note: string };
  references?: { logIds: string[]; entryIds: string[]; codeVersionIds?: string[] };
}

export type SaveKnowledgeEntry = (input: EntryInput, options?: EntrySaveOptions) => string;

export interface EntryCategoryChange { id: string; from: string; to: string }

export interface EntryEditSnapshot {
  entry: KnowledgeEntry;
  logLinks: KnowledgeLogLink[];
  relations: KnowledgeRelation[];
}

export function entryEditSnapshot(data: KnowledgeData, id: string): EntryEditSnapshot | undefined {
  const entry = data.entries.find((item) => item.id === id);
  if (!entry) return;
  return {
    entry,
    logLinks: data.logLinks.filter((link) => link.entryId === id),
    relations: data.relations.filter((relation) => otherEntryId(relation, id) !== undefined),
  };
}

export function sameEntryEdit(first: EntryEditSnapshot, second: EntryEditSnapshot): boolean {
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
  const comparable = ({ entry, logLinks, relations }: EntryEditSnapshot) => JSON.stringify({
    entry: [entry.id, entry.title, entry.aliases, entry.category, entry.content, entry.createdAt, entry.codeVersionIds, entry.codeAnnotations],
    logLinks: [...logLinks].sort(byId),
    relations: [...relations].sort(byId),
  });
  return comparable(first) === comparable(second);
}

interface KnowledgeStore extends KnowledgeData {
  isLoaded: boolean;
  error: string;
  loadKnowledge: () => void;
  saveEntry: SaveKnowledgeEntry;
  applyEntryCategories: (changes: EntryCategoryChange[]) => void;
  restoreEntryEdit: (expected: EntryEditSnapshot, replacement: EntryEditSnapshot) => void;
  deleteEntry: (id: string) => void;
  linkLog: (entryId: string, logId: string, note: string, annotation?: RelationAnnotation) => void;
  saveReviewedLog: (logId: string, content: string, originalContent: string, suggestions: LogReviewSuggestion[]) => void;
  unlinkLog: (id: string) => void;
  relate: (sourceId: string, targetId: string, annotation?: RelationAnnotation) => void;
  removeRelation: (id: string) => void;
  setEntryCodeLinked: (entryId: string, versionId: string, linked: boolean, annotation?: RelationAnnotation) => void;
  annotateLink: (kind: 'log-entry' | 'entry-entry', id: string, input: RelationAnnotation) => void;
  annotateEntryCode: (entryId: string, versionId: string, input: RelationAnnotation) => void;
}

export const useKnowledgeStore = create<KnowledgeStore>((set, get) => {
  const persist = (data: KnowledgeData) => {
    if (get().error) throw new Error(get().error);
    validateKnowledge(data, new Set(useStudyLogStore.getState().logs.map((log) => log.id)));
    localStorage.setItem(STORAGE_KEYS.KNOWLEDGE, JSON.stringify(data));
    set(data);
  };
  const data = (): KnowledgeData => ({ version: 1, entries: get().entries, logLinks: get().logLinks, relations: get().relations });
  return {
    ...emptyKnowledge(), isLoaded: false, error: '',
    loadKnowledge: () => {
      if (get().isLoaded) return;
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.KNOWLEDGE);
        set({ ...(raw === null ? emptyKnowledge() : validateKnowledge(JSON.parse(raw))), isLoaded: true });
      } catch { set({ isLoaded: true, error: '知识数据读取失败，已保留原数据。请先保留备份并联系开发者。' }); }
    },
    saveEntry: (input, { id, fromLog, references } = {}) => {
      const title = input.title.trim();
      if (!title) throw new Error('请填写词条名称。');
      const old = id ? get().entries.find((item) => item.id === id) : undefined;
      if (id && !old) throw new Error('这个词条已不存在，请重新选择。');
      const aliases = [...new Map(input.aliases.map((alias) => [normalizedName(alias), alias.trim()])).values()]
        .filter((alias) => alias && normalizedName(alias) !== normalizedName(title));
      const now = Date.now();
      const codeVersionIds = references?.codeVersionIds ?? old?.codeVersionIds;
      const item: KnowledgeEntry = {
        ...input, title, aliases, category: input.category.trim(),
        id: old?.id ?? generateId(), createdAt: old?.createdAt ?? now, updatedAt: now,
        codeVersionIds,
        codeAnnotations: old?.codeAnnotations?.filter(({ versionId }) => codeVersionIds?.includes(versionId)),
      };
      const next = data();
      next.entries = old ? next.entries.map((entry) => entry.id === id ? item : entry) : [...next.entries, item];
      if (references) {
        const previousLogs = new Map(next.logLinks.filter((link) => link.entryId === item.id).map((link) => [link.logId, link]));
        next.logLinks = [
          ...next.logLinks.filter((link) => link.entryId !== item.id),
          ...references.logIds.map((logId) => previousLogs.get(logId) ?? { id: generateId(), entryId: item.id, logId, note: '' }),
        ];
        const previousRelations = new Map(next.relations.map((relation) => [otherEntryId(relation, item.id), relation]));
        next.relations = [
          ...next.relations.filter((relation) => otherEntryId(relation, item.id) === undefined),
          ...references.entryIds.map((entryId) => previousRelations.get(entryId) ?? { id: generateId(), sourceId: item.id, targetId: entryId }),
        ];
      }
      if (fromLog && !next.logLinks.some((link) => link.logId === fromLog.id && link.entryId === item.id)) {
        next.logLinks = [...next.logLinks, { id: generateId(), entryId: item.id, logId: fromLog.id, note: fromLog.note.trim() }];
      }
      persist(next);
      return item.id;
    },
    applyEntryCategories: (changes) => {
      if (!changes.length) return;
      const next = data();
      const byId = new Map(next.entries.map((entry) => [entry.id, entry]));
      for (const { id, from } of changes) {
        if (byId.get(id)?.category !== from) throw new Error('词条分类已有其他修改，请核对后再操作。');
      }
      const destinations = new Map(changes.map(({ id, to }) => [id, to]));
      const updatedAt = Date.now();
      next.entries = next.entries.map((entry) => {
        const category = destinations.get(entry.id);
        return category === undefined || category === entry.category ? entry : { ...entry, category, updatedAt };
      });
      persist(next);
    },
    restoreEntryEdit: (expected, replacement) => {
      const next = data();
      const id = expected.entry.id;
      const current = entryEditSnapshot(next, id);
      if (!current || id !== replacement.entry.id || !sameEntryEdit(current, expected)) {
        throw new Error('词条或关联已有其他修改，请核对后再操作。');
      }
      next.entries = next.entries.map((entry) => entry.id === id ? replacement.entry : entry);
      next.logLinks = [...next.logLinks.filter((link) => link.entryId !== id), ...replacement.logLinks];
      next.relations = [...next.relations.filter((relation) => otherEntryId(relation, id) === undefined), ...replacement.relations];
      persist(next);
    },
    deleteEntry: (id) => persist({
      ...data(), entries: get().entries.filter((item) => item.id !== id),
      logLinks: get().logLinks.filter((item) => item.entryId !== id),
      relations: get().relations.filter((item) => item.sourceId !== id && item.targetId !== id),
    }),
    saveReviewedLog: (logId, content, originalContent, suggestions) => {
      const study = useStudyLogStore.getState();
      const log = study.logs.find(({ id }) => id === logId);
      if (!log || log.content !== originalContent) throw new Error('日志已有修改，请重新打开后再整理。');
      const tags = new Set(log.tags.map(normalizedName));
      const addedTags: string[] = [];
      const next = data();
      const names = new Map(next.entries.flatMap((entry) => entryNames(entry).map((name) => [name, entry.id] as const)));
      const entryIds = new Set(next.entries.map(({ id }) => id));
      const linked = new Set(next.logLinks.filter((link) => link.logId === logId).map((link) => link.entryId));
      const created: KnowledgeEntry[] = [];
      const links: KnowledgeLogLink[] = [];
      for (const suggestion of suggestions) {
        if (suggestion.kind === 'tag') {
          const tag = suggestion.tag.trim();
          if (!tag || tags.has(normalizedName(tag))) continue;
          tags.add(normalizedName(tag));
          addedTags.push(tag);
          continue;
        }
        let entryId: string;
        if (suggestion.kind === 'entry') {
          const title = suggestion.title.trim();
          if (!title || !suggestion.content.trim()) throw new Error('请为所选新词条填写名称和正文。');
          const existing = names.get(normalizedName(title));
          if (existing) throw new Error(`「${title}」与已有或所选词条名称重复，请修改后保存。`);
          entryId = generateId();
          names.set(normalizedName(title), entryId);
          const now = Date.now();
          created.push({ id: entryId, title, category: suggestion.category.trim(), content: suggestion.content.trim(), aliases: [], createdAt: now, updatedAt: now });
        } else {
          entryId = suggestion.entryId;
          if (!entryIds.has(entryId)) throw new Error('所选关联的词条已不存在，请重新获取建议。');
        }
        if (linked.has(entryId)) continue;
        linked.add(entryId);
        links.push({ id: generateId(), logId, entryId, note: suggestion.kind === 'link' ? suggestion.note.trim() : '' });
      }
      if (!links.length) { study.updateLogContent(logId, content, originalContent, addedTags); return; }
      if (get().error) throw new Error(get().error);
      next.entries = [...next.entries, ...created];
      next.logLinks = [...next.logLinks, ...links];
      validateKnowledge(next, new Set(study.logs.map(({ id }) => id)));
      const previous = localStorage.getItem(STORAGE_KEYS.KNOWLEDGE);
      localStorage.setItem(STORAGE_KEYS.KNOWLEDGE, JSON.stringify(next));
      try { study.updateLogContent(logId, content, originalContent, addedTags); }
      catch (error) {
        if (previous === null) localStorage.removeItem(STORAGE_KEYS.KNOWLEDGE);
        else localStorage.setItem(STORAGE_KEYS.KNOWLEDGE, previous);
        throw error;
      }
      set(next);
    },
    linkLog: (entryId, logId, note, annotation) => {
      const existing = get().logLinks.find((item) => item.entryId === entryId && item.logId === logId);
      persist({ ...data(), logLinks: existing
        ? get().logLinks.map((item) => item.id === existing.id ? { ...item, note: note.trim() } : item)
        : [...get().logLinks, { id: generateId(), entryId, logId, note: note.trim(), annotation }] });
    },
    unlinkLog: (id) => persist({ ...data(), logLinks: get().logLinks.filter((item) => item.id !== id) }),
    relate: (sourceId, targetId, annotation) => {
      if (sourceId === targetId) throw new Error('请选择另一个词条。');
      if (get().relations.some((item) => item.sourceId === sourceId && item.targetId === targetId || item.sourceId === targetId && item.targetId === sourceId)) return;
      persist({ ...data(), relations: [...get().relations, { id: generateId(), sourceId, targetId, annotation }] });
    },
    removeRelation: (id) => persist({ ...data(), relations: get().relations.filter((item) => item.id !== id) }),
    setEntryCodeLinked: (entryId, versionId, linked, annotation) => {
      const entry = get().entries.find((item) => item.id === entryId);
      if (!entry) throw new Error('这个词条已不存在。');
      const code = useProjectCodeStore.getState().data;
      if (linked && !code.versions.some((version) => version.id === versionId)) throw new Error('这个代码版本已不存在。');
      const previous = entryCodeIds(entry, code.links);
      if (previous.includes(versionId) === linked) return;
      const codeVersionIds = linked ? [...previous, versionId] : previous.filter((id) => id !== versionId);
      const legacyAnnotations = entry.codeVersionIds === undefined ? code.links.flatMap((link) =>
        link.target.kind === 'entry' && link.target.id === entryId && link.annotation ? [{ versionId: link.versionId, annotation: link.annotation }] : []) : [];
      const codeAnnotations = (entry.codeAnnotations ?? legacyAnnotations).filter((item) => codeVersionIds.includes(item.versionId));
      if (linked && annotation) codeAnnotations.push({ versionId, annotation });
      const updated = { ...entry, codeVersionIds, codeAnnotations: codeAnnotations.length ? codeAnnotations : undefined };
      persist({ ...data(), entries: get().entries.map((item) => item.id === entryId ? updated : item) });
    },
    annotateLink: (kind, id, input) => {
      const annotation = cleanRelationAnnotation(input);
      const next = data();
      const links = kind === 'log-entry' ? next.logLinks : next.relations;
      if (!links.some((link) => link.id === id)) throw new Error('这条关联已不存在。');
      if (kind === 'log-entry') next.logLinks = next.logLinks.map((link) => link.id === id ? { ...link, annotation } : link);
      else next.relations = next.relations.map((link) => link.id === id ? { ...link, annotation } : link);
      persist(next);
    },
    annotateEntryCode: (entryId, versionId, input) => {
      const annotation = cleanRelationAnnotation(input);
      const entry = get().entries.find((item) => item.id === entryId);
      const code = useProjectCodeStore.getState().data;
      const codeVersionIds = entry ? entryCodeIds(entry, code.links) : [];
      if (!entry || !codeVersionIds.includes(versionId) || !code.versions.some((version) => version.id === versionId)) {
        throw new Error('这条关联已不存在。');
      }
      const codeAnnotations = (entry.codeAnnotations ?? []).filter((item) => item.versionId !== versionId);
      if (annotation) codeAnnotations.push({ versionId, annotation });
      const updated = { ...entry, codeVersionIds, codeAnnotations: codeAnnotations.length ? codeAnnotations : undefined };
      persist({ ...data(), entries: get().entries.map((item) => item.id === entryId ? updated : item) });
    },
  };
});
