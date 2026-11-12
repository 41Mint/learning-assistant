import type { KnowledgeData, StudyLog } from '../types';
import type { ProjectCodeData } from '../types/projectCode';
import type { RelationAnnotation, RelationNodeKind, RelationNodeRef } from '../types/relations';
import { logLabel } from './growth';
import { codeVersionHref, effectiveCodeLinks } from './projectCode';

export const RELATION_KIND_LABELS: Record<RelationNodeKind, string> = {
  log: '学习日志', entry: '知识词条', code: '代码版本',
};

export interface RelationNode extends RelationNodeRef {
  title: string;
  detail?: string;
  href: string;
  searchFields: string[];
}

export type RelationOrigin =
  | { kind: 'log-entry' | 'entry-entry'; linkId: string }
  | { kind: 'log-code' | 'entry-code'; ownerId: string; versionId: string };

export interface RelationEdge {
  key: string;
  node: RelationNode;
  origin: RelationOrigin;
  annotation?: RelationAnnotation;
  originalNote?: string;
}

export type RelationConnection = Omit<RelationEdge, 'node'> & { first: RelationNode; second: RelationNode };

export function relationNodeKey(node: RelationNodeRef): string {
  return JSON.stringify([node.kind, node.id]);
}

export function relationLabel(edge: Pick<RelationEdge, 'annotation'>): string {
  return edge.annotation?.label.trim() || '相关';
}

export function buildRelationNetwork(logs: StudyLog[], knowledge: KnowledgeData, code: ProjectCodeData) {
  const projects = new Map(code.projects.map((project) => [project.id, project.name]));
  const nodes = new Map<string, RelationNode>();
  for (const log of logs) {
    const title = logLabel(log);
    const node: RelationNode = { kind: 'log', id: log.id, title, href: '#history/' + encodeURIComponent(log.date), searchFields: [title, ...log.tags] };
    nodes.set(relationNodeKey(node), node);
  }
  for (const entry of knowledge.entries) {
    const node: RelationNode = {
      kind: 'entry', id: entry.id, title: entry.title, detail: entry.category, href: '#knowledge/' + encodeURIComponent(entry.id),
      searchFields: [entry.title, ...entry.aliases, entry.category],
    };
    nodes.set(relationNodeKey(node), node);
  }
  for (const version of code.versions) {
    const node: RelationNode = {
      kind: 'code', id: version.id, title: version.path.split('/').at(-1) ?? version.path,
      detail: [projects.get(version.projectId), new Date(version.savedAt).toLocaleString('zh-CN')].filter(Boolean).join(' · '),
      href: codeVersionHref(version.id),
      searchFields: [version.path, projects.get(version.projectId) ?? '', version.note],
    };
    nodes.set(relationNodeKey(node), node);
  }
  const connections: RelationConnection[] = [];
  const add = (from: RelationNodeRef, to: RelationNodeRef, origin: RelationOrigin, annotation?: RelationAnnotation, originalNote?: string) => {
    const first = nodes.get(relationNodeKey(from));
    const second = nodes.get(relationNodeKey(to));
    if (first && second) connections.push({ key: JSON.stringify(origin), first, second, origin, annotation, originalNote });
  };
  for (const link of knowledge.logLinks) {
    add({ kind: 'log', id: link.logId }, { kind: 'entry', id: link.entryId }, { kind: 'log-entry', linkId: link.id }, link.annotation, link.note);
  }
  for (const link of knowledge.relations) {
    add({ kind: 'entry', id: link.sourceId }, { kind: 'entry', id: link.targetId }, { kind: 'entry-entry', linkId: link.id }, link.annotation);
  }
  for (const link of effectiveCodeLinks(code, [], knowledge.entries)) {
    if (link.target.kind === 'practice') continue;
    const kind = link.target.kind === 'log' ? 'log-code' : 'entry-code';
    add(link.target, { kind: 'code', id: link.versionId }, { kind, ownerId: link.target.id, versionId: link.versionId }, link.annotation);
  }
  return { nodes, connections };
}

export function buildRelationGraph(target: RelationNodeRef, logs: StudyLog[], knowledge: KnowledgeData, code: ProjectCodeData) {
  const { nodes, connections } = buildRelationNetwork(logs, knowledge, code);
  const center = nodes.get(relationNodeKey(target));
  const edges: RelationEdge[] = [];
  if (center) for (const { first, second, ...edge } of connections) {
    const node = first === center ? second : second === center ? first : undefined;
    if (node) edges.push({ ...edge, node });
  }
  return { center, edges };
}
