import { create } from 'zustand';
import type { GrowthBoardView } from '../types';
import type { RelationNodeRef } from '../types/relations';
import { searchWords } from '../utils/resourceSearch';
import { getTodayDate } from '../utils/storage';
import { readCodeCitation } from '../utils/codeCitation';
import type { CodeLineRange } from '../utils/codeCitation';
import { PRACTICE_IDEAS_LABEL, PRACTICE_RECORDS_LABEL } from '../utils/growthLabels';

export interface SearchLocation {
  page: 'history' | 'knowledge' | 'code';
  id: string;
  words: string[];
  inSource: boolean;
}

export const GROWTH_VIEWS = [
  { id: 'recent', label: PRACTICE_RECORDS_LABEL, href: '#path' },
  { id: 'try', label: PRACTICE_IDEAS_LABEL, href: '#path/try' },
] as const;
export type GrowthView = GrowthBoardView | 'topics';

export const RECYCLE_CATEGORIES = [
  { id: 'log', label: '日志' }, { id: 'entry', label: '词条' }, { id: 'code', label: '代码' },
] as const;
export type RecycleCategory = typeof RECYCLE_CATEGORIES[number]['id'];

export function recycleBinHref(category: RecycleCategory) {
  return category === 'log' ? '#data' : `#data?trash=${category}`;
}

export function readWorkspaceHash() {
  const [path, query = ''] = window.location.hash.slice(1).split('?');
  const [page, value = '', detail = ''] = path.split('/');
  const params = new URLSearchParams(query);
  const recycleCategory = RECYCLE_CATEGORIES.find(({ id }) => id === params.get('trash'))?.id ?? 'log';
  try {
    const id = decodeURIComponent(value);
    const decodedDetail = decodeURIComponent(detail);
    const words = searchWords(params.get('find') ?? '');
    const search: SearchLocation | null = id && words.length && (page === 'history' || page === 'knowledge' || page === 'code')
      ? { page, id, words, inSource: page === 'code' && params.get('source') === '1' } : null;
    const relation: RelationNodeRef | null = page === 'relations' && decodedDetail && (id === 'log' || id === 'entry' || id === 'code')
      ? { kind: id, id: decodedDetail } : null;
    const groupId = page === 'path' ? params.get('group') : null;
    const from = params.get('from');
    const groupBoardView: GrowthBoardView | null = groupId && (from === 'recent' || from === 'try') ? from : null;
    const cardId = page === 'path' ? params.get('card') : null;
    const exerciseId = page === 'path' && id === 'try' ? decodedDetail || null : null;
    const practiceTarget = page === 'path' && id && decodedDetail && !exerciseId
      ? { outcomeId: id, practiceId: decodedDetail } : null;
    const growthView: GrowthView = page === 'path' && (id === 'try' || (!decodedDetail && id === 'topics')) ? id : 'recent';
    const topicTaskId = growthView === 'topics' ? params.get('task') : null;
    return { page, id, search, relation, growthView, groupId, groupBoardView, cardId, exerciseId, practiceTarget, recycleCategory, topicTaskId };
  } catch { return { page, id: '', search: null, relation: null, growthView: 'recent' as GrowthView, groupId: null, groupBoardView: null, cardId: null, exerciseId: null, practiceTarget: null, recycleCategory, topicTaskId: null }; }
}
const initial = readWorkspaceHash();
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T12:00:00`).getTime());

function withGrowthGroup(href: string, groupId?: string, boardView?: GrowthBoardView) {
  if (!groupId) return href;
  const params = new URLSearchParams({ group: groupId });
  if (boardView) params.set('from', boardView);
  return href + '?' + params;
}

export function growthOutcomeHref(outcomeId: string, groupId?: string, boardView?: GrowthBoardView) {
  return withGrowthGroup('#path/' + encodeURIComponent(outcomeId), groupId, boardView);
}

export function practiceHref(outcomeId: string, practiceId: string, groupId?: string, boardView?: GrowthBoardView): string {
  return withGrowthGroup(growthOutcomeHref(outcomeId) + '/' + encodeURIComponent(practiceId), groupId, boardView);
}

export function searchHref(href: string, query: string, inSource = false): string {
  const [path, queryString] = href.split('?');
  const params = new URLSearchParams(queryString);
  params.set('find', query.trim());
  if (inSource) params.set('source', '1');
  return path + '?' + params;
}

export function growthBoardHref(view: GrowthBoardView, groupId?: string | null, cardId?: string) {
  const path = view === 'try' ? '#path/try' : '#path';
  const params = new URLSearchParams();
  if (groupId) params.set('group', groupId);
  if (cardId) params.set('card', cardId);
  return params.size ? `${path}?${params}` : path;
}

export function exerciseHref(id: string, groupId?: string, boardView?: GrowthBoardView) {
  return withGrowthGroup('#path/try/' + encodeURIComponent(id), groupId, boardView);
}

export function topicTaskHref(taskId: string) {
  return '#path/topics?' + new URLSearchParams({ task: taskId });
}

export function relationHref({ kind, id }: RelationNodeRef): string {
  return '#relations/' + kind + '/' + encodeURIComponent(id);
}

export function knowledgeNetworkHref(entryId?: string): string {
  return entryId ? '#network/' + encodeURIComponent(entryId) : '#network';
}

export function hasWorkspaceEditor(page: string): boolean {
  return Boolean(document.getElementById(page)?.querySelector('form:not([data-preserves-on-navigation])'));
}

export function workspaceResourceTarget(href: string) {
  return hasWorkspaceEditor(href.slice(1).split('/')[0]) ? { target: '_blank', rel: 'noopener' } : {};
}

interface WorkspaceStore {
  historyDate: string;
  entryId: string | null;
  codeVersionId: string | null;
  codeCitationRange: CodeLineRange | undefined;
  practiceTarget: { outcomeId: string; practiceId: string } | null;
  growthOutcomeId: string | null;
  growthGroupId: string | null;
  growthGroupBoardView: GrowthBoardView | null;
  growthCardId: string | null;
  growthExerciseId: string | null;
  growthView: GrowthView;
  topicTaskId: string | null;
  recycleCategory: RecycleCategory;
  search: SearchLocation | null;
  relationTarget: RelationNodeRef | null;
  networkEntryRequest: { id: string } | null;
  syncHash: () => void;
  openLog: (date: string) => void;
  openEntry: (id: string) => void;
}
export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  historyDate: initial.page === 'history' && isDate(initial.id) ? initial.id : getTodayDate(),
  entryId: initial.page === 'knowledge' && initial.id ? initial.id : null,
  codeVersionId: initial.page === 'code' && initial.id ? initial.id : null,
  codeCitationRange: readCodeCitation(window.location.hash)?.range,
  practiceTarget: initial.practiceTarget,
  growthOutcomeId: initial.page === 'path' && initial.growthView === 'recent' ? initial.id || null : null,
  growthGroupId: initial.groupId,
  growthGroupBoardView: initial.groupBoardView,
  growthCardId: initial.cardId,
  growthExerciseId: initial.exerciseId,
  growthView: initial.growthView,
  topicTaskId: initial.topicTaskId,
  recycleCategory: initial.recycleCategory,
  search: initial.search,
  relationTarget: initial.relation,
  networkEntryRequest: initial.page === 'network' && initial.id ? { id: initial.id } : null,
  syncHash: () => {
    const { page, id, search, relation, growthView, groupId, groupBoardView, cardId, exerciseId, practiceTarget, recycleCategory, topicTaskId } = readWorkspaceHash();
    const selection: Partial<WorkspaceStore> = { search, relationTarget: relation, codeCitationRange: readCodeCitation(window.location.hash)?.range, topicTaskId };
    if (page === 'network' && id && window.history.state?.knowledgeNetworkEntry !== id) {
      // Back and Forward revisit an existing entry, while a new link requests focus.
      window.history.replaceState({ ...window.history.state, knowledgeNetworkEntry: id }, '');
      selection.networkEntryRequest = { id };
    }
    if (page === 'knowledge' && id) selection.entryId = id;
    if (page === 'history' && isDate(id)) selection.historyDate = id;
    if (page === 'code') selection.codeVersionId = id || null;
    if (page === 'data') selection.recycleCategory = recycleCategory;
    if (page === 'path') {
      selection.practiceTarget = practiceTarget;
      selection.growthOutcomeId = growthView === 'recent' ? id || null : null;
      selection.growthView = growthView;
      selection.growthGroupId = groupId;
      selection.growthGroupBoardView = groupBoardView;
      selection.growthCardId = cardId;
      selection.growthExerciseId = exerciseId;
    }
    set(selection);
  },
  openLog: (date) => { set({ historyDate: date, search: null }); window.location.hash = `history/${date}`; },
  openEntry: (id) => { set({ entryId: id, search: null }); window.location.hash = `knowledge/${encodeURIComponent(id)}`; },
}));
