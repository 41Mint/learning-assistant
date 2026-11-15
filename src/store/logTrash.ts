import { useGrowthStore } from './growthStore';
import { useKnowledgeStore } from './knowledgeStore';
import { useProjectCodeStore } from './projectCodeStore';
import { useStudyLogStore } from './studyLogStore';
import { validateGrowth } from '../utils/growth';
import { referencedImageIds } from '../utils/imageStorage';
import { validateKnowledge } from '../utils/knowledge';
import { updateProjectCode } from '../utils/projectCodeStorage';
import { LEGACY_LOG_PREFIX, STORAGE_KEYS } from '../utils/storage';
import { isTrashedLog, readStoredLogs } from '../utils/studyLogs';

export async function purgeTrashedLog(id: string): Promise<void> {
  const writes: { key: string; previous: string | null; value: string | null }[] = [];
  const write = (key: string, value: string | null) => {
    const previous = localStorage.getItem(key);
    if (previous === value) return;
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    writes.push({ key, previous, value });
  };
  const code = await updateProjectCode((data) => ({
    ...data,
    links: data.links.filter(({ target }) => target.kind !== 'log' || target.id !== id),
  }), () => {
    const logs = readStoredLogs();
    const target = logs.find((log) => log.id === id && isTrashedLog(log));
    if (!target) throw new Error('这篇日志已不在回收站。');
    const remaining = logs.filter((log) => log.id !== id);
    const knowledgeRaw = localStorage.getItem(STORAGE_KEYS.KNOWLEDGE);
    const knowledge = knowledgeRaw === null ? undefined : validateKnowledge(JSON.parse(knowledgeRaw));
    const growthRaw = localStorage.getItem(STORAGE_KEYS.GROWTH);
    const growth = growthRaw === null ? undefined : validateGrowth(JSON.parse(growthRaw));
    const usedImages = new Set([...remaining, ...(knowledge?.entries ?? [])].flatMap(({ content }) => referencedImageIds(content)));
    if (knowledge) {
      knowledge.logLinks = knowledge.logLinks.filter((link) => link.logId !== id);
      write(STORAGE_KEYS.KNOWLEDGE, JSON.stringify(knowledge));
    }
    if (growth) {
      for (const outcome of growth.outcomes) {
        for (const practice of outcome.practices) practice.logIds = practice.logIds.filter((linkedId) => linkedId !== id);
      }
      for (const exercise of growth.exercises) exercise.sources.logIds = exercise.sources.logIds.filter((linkedId) => linkedId !== id);
      write(STORAGE_KEYS.GROWTH, JSON.stringify(growth));
    }
    write(LEGACY_LOG_PREFIX + target.date, null);
    write(STORAGE_KEYS.STUDY_LOGS, JSON.stringify(remaining));
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
  useStudyLogStore.getState().loadLogs();
  const knowledgeRaw = localStorage.getItem(STORAGE_KEYS.KNOWLEDGE);
  if (knowledgeRaw !== null) useKnowledgeStore.setState(validateKnowledge(JSON.parse(knowledgeRaw)));
  const growthRaw = localStorage.getItem(STORAGE_KEYS.GROWTH);
  if (growthRaw !== null) useGrowthStore.setState({ ...validateGrowth(JSON.parse(growthRaw)), previousArrangement: undefined });
  useProjectCodeStore.setState({ data: code });
}
