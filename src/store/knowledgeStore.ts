import { create } from 'zustand';
import type { KnowledgeData, KnowledgeEntry } from '../types';
import type { RelationAnnotation } from '../types/relations';
import { emptyKnowledge, normalizedName, otherEntryId, validateKnowledge } from '../utils/knowledge';
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

interface KnowledgeStore extends KnowledgeData {
  isLoaded: boolean;
  error: string;
  loadKnowledge: () => void;
  saveEntry: (input: EntryInput, options?: EntrySaveOptions) => string;
  deleteEntry: (id: string) => void;
  linkLog: (entryId: string, logId: string, note: string) => void;
  unlinkLog: (id: string) => void;
  relate: (sourceId: string, targetId: string) => void;
  removeRelation: (id: string) => void;
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
    deleteEntry: (id) => persist({
      ...data(), entries: get().entries.filter((item) => item.id !== id),
      logLinks: get().logLinks.filter((item) => item.entryId !== id),
      relations: get().relations.filter((item) => item.sourceId !== id && item.targetId !== id),
    }),
    linkLog: (entryId, logId, note) => {
      const existing = get().logLinks.find((item) => item.entryId === entryId && item.logId === logId);
      persist({ ...data(), logLinks: existing
        ? get().logLinks.map((item) => item.id === existing.id ? { ...item, note: note.trim() } : item)
        : [...get().logLinks, { id: generateId(), entryId, logId, note: note.trim() }] });
    },
    unlinkLog: (id) => persist({ ...data(), logLinks: get().logLinks.filter((item) => item.id !== id) }),
    relate: (sourceId, targetId) => {
      if (sourceId === targetId) throw new Error('请选择另一个词条。');
      if (get().relations.some((item) => item.sourceId === sourceId && item.targetId === targetId || item.sourceId === targetId && item.targetId === sourceId)) return;
      persist({ ...data(), relations: [...get().relations, { id: generateId(), sourceId, targetId }] });
    },
    removeRelation: (id) => persist({ ...data(), relations: get().relations.filter((item) => item.id !== id) }),
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
