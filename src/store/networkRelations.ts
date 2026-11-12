import type { RelationAnnotation, RelationNodeRef } from '../types/relations';
import type { RelationOrigin } from '../utils/relations';
import { relationNodeKey } from '../utils/relations';
import { useKnowledgeStore } from './knowledgeStore';
import { useProjectCodeStore } from './projectCodeStore';
import { useStudyLogStore } from './studyLogStore';

export function canConnectNetworkNodes(first: RelationNodeRef, second: RelationNodeRef): boolean {
  return relationNodeKey(first) !== relationNodeKey(second) && (first.kind !== second.kind || first.kind === 'entry');
}

export async function connectNetworkNodes(first: RelationNodeRef, second: RelationNodeRef, annotation?: RelationAnnotation): Promise<void> {
  if (!canConnectNetworkNodes(first, second)) throw new Error('请选择两份可以关联的资料。');
  const knowledge = useKnowledgeStore.getState();
  if (first.kind === 'entry' && second.kind === 'entry') {
    knowledge.relate(first.id, second.id, annotation);
    return;
  }
  const entry = [first, second].find((node) => node.kind === 'entry');
  const log = [first, second].find((node) => node.kind === 'log');
  const code = [first, second].find((node) => node.kind === 'code');
  if (log && !useStudyLogStore.getState().logs.some((item) => item.id === log.id)) throw new Error('这篇学习日志已不存在。');
  if (entry && log) {
    if (!knowledge.logLinks.some((link) => link.entryId === entry.id && link.logId === log.id)) knowledge.linkLog(entry.id, log.id, '', annotation);
  } else if (entry && code) knowledge.setEntryCodeLinked(entry.id, code.id, true, annotation);
  else if (log && code) await useProjectCodeStore.getState().linkVersion(code.id, { kind: 'log', id: log.id }, annotation);
}

export async function removeNetworkConnection(origin: RelationOrigin): Promise<void> {
  const knowledge = useKnowledgeStore.getState();
  switch (origin.kind) {
    case 'entry-entry': knowledge.removeRelation(origin.linkId); break;
    case 'log-entry': knowledge.unlinkLog(origin.linkId); break;
    case 'entry-code': knowledge.setEntryCodeLinked(origin.ownerId, origin.versionId, false); break;
    case 'log-code': await useProjectCodeStore.getState().unlinkVersion(origin.versionId, { kind: 'log', id: origin.ownerId }); break;
  }
}
