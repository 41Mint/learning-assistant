import { useGrowthStore } from './growthStore';
import { useKnowledgeStore } from './knowledgeStore';
import { useProjectCodeStore } from './projectCodeStore';
import { useStudyLogStore } from './studyLogStore';
import { validateGrowth } from '../utils/growth';
import { referencedImageIds } from '../utils/imageStorage';
import { otherEntryId, validateKnowledge } from '../utils/knowledge';
import { updateProjectCode } from '../utils/projectCodeStorage';
import { LEGACY_LOG_PREFIX, STORAGE_KEYS } from '../utils/storage';
import { isTrashedLog, readStoredLogs } from '../utils/studyLogs';

export async function purgeTrashedResource(kind: 'log' | 'entry' | 'code', id: string): Promise<void> {
  const writes: { key: string; previous: string | null; value: string | null }[] = [];
  const write = (key: string, value: string | null) => {
    const previous = localStorage.getItem(key);
    if (previous === value) return;
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    writes.push({ key, previous, value });
  };
  const code = await updateProjectCode((data) => {
    if (kind === 'code') {
      if (!data.trash.versions.some((version) => version.id === id)) throw new Error('这个代码版本已不在回收站。');
      return { ...data, trash: {
        versions: data.trash.versions.filter((version) => version.id !== id),
        links: data.trash.links.filter((link) => link.versionId !== id),
      } };
    }
    const otherTarget = ({ target }: typeof data.links[number]) => target.kind !== kind || target.id !== id;
    return { ...data, links: data.links.filter(otherTarget), trash: { ...data.trash, links: data.trash.links.filter(otherTarget) } };
  }, () => {
    const logs = kind === 'code' ? [] : readStoredLogs();
    const knowledgeRaw = localStorage.getItem(STORAGE_KEYS.KNOWLEDGE);
    const knowledge = knowledgeRaw === null ? undefined : validateKnowledge(JSON.parse(knowledgeRaw));
    const growthRaw = localStorage.getItem(STORAGE_KEYS.GROWTH);
    const growth = growthRaw === null ? undefined : validateGrowth(JSON.parse(growthRaw));
    const log = kind === 'log' ? logs.find((item) => item.id === id && isTrashedLog(item)) : undefined;
    const entry = kind === 'entry' ? knowledge?.trash.entries.find((item) => item.id === id) : undefined;
    const target = log ?? entry;
    if (kind !== 'code' && !target) throw new Error(`${kind === 'log' ? '这篇日志' : '这个词条'}已不在回收站。`);
    const remaining = log ? logs.filter((item) => item.id !== id) : logs;
    if (knowledge && log) {
      knowledge.logLinks = knowledge.logLinks.filter((link) => link.logId !== id);
      knowledge.trash.logLinks = knowledge.trash.logLinks.filter((link) => link.logId !== id);
    }
    if (knowledge && entry) {
      knowledge.trash.entries = knowledge.trash.entries.filter((item) => item.id !== id);
      knowledge.trash.logLinks = knowledge.trash.logLinks.filter((link) => link.entryId !== id);
      knowledge.trash.relations = knowledge.trash.relations.filter((relation) => otherEntryId(relation, id) === undefined);
    }
    if (knowledge && kind === 'code') {
      for (const item of [...knowledge.entries, ...knowledge.trash.entries]) {
        item.codeVersionIds = item.codeVersionIds?.filter((versionId) => versionId !== id);
        item.codeAnnotations = item.codeAnnotations?.filter(({ versionId }) => versionId !== id);
      }
    }
    if (knowledge) write(STORAGE_KEYS.KNOWLEDGE, JSON.stringify(knowledge));
    if (growth) {
      const referenceKey = kind === 'code' ? 'codeVersionIds' : log ? 'logIds' : 'entryIds';
      for (const outcome of growth.outcomes) {
        for (const practice of outcome.practices) {
          const linkedIds = practice[referenceKey];
          if (linkedIds?.includes(id)) practice[referenceKey] = linkedIds.filter((linkedId) => linkedId !== id);
        }
      }
      for (const exercise of growth.exercises) exercise.sources[referenceKey] = exercise.sources[referenceKey].filter((linkedId) => linkedId !== id);
      write(STORAGE_KEYS.GROWTH, JSON.stringify(growth));
    }
    if (log) {
      write(LEGACY_LOG_PREFIX + log.date, null);
      write(STORAGE_KEYS.STUDY_LOGS, JSON.stringify(remaining));
    }
    if (!target) return [];
    const usedImages = new Set([...remaining, ...(knowledge?.entries ?? []), ...(knowledge?.trash.entries ?? [])]
      .flatMap(({ content }) => referencedImageIds(content)));
    return referencedImageIds(target.content).filter((imageId) => !usedImages.has(imageId));
  }).catch((error: unknown) => {
    // IndexedDB rolls back its writes. Restore only local values still owned by this operation.
    for (const { key, previous, value } of writes.reverse()) {
      if (localStorage.getItem(key) !== value) continue;
      if (previous === null) localStorage.removeItem(key);
      else localStorage.setItem(key, previous);
    }
    throw error;
  });
  if (kind === 'log') useStudyLogStore.getState().loadLogs();
  const knowledgeRaw = localStorage.getItem(STORAGE_KEYS.KNOWLEDGE);
  if (knowledgeRaw !== null) useKnowledgeStore.setState(validateKnowledge(JSON.parse(knowledgeRaw)));
  const growthRaw = localStorage.getItem(STORAGE_KEYS.GROWTH);
  if (growthRaw !== null) useGrowthStore.setState({ ...validateGrowth(JSON.parse(growthRaw)), arrangementHistory: { undo: [], redo: [] } });
  useProjectCodeStore.setState({ data: code });
}
