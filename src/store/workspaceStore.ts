import { create } from 'zustand';
import type { RelationNodeRef } from '../types/relations';
import { searchWords } from '../utils/resourceSearch';
import { getTodayDate } from '../utils/storage';

export interface SearchLocation {
  page: 'history' | 'knowledge' | 'code';
  id: string;
  words: string[];
  inSource: boolean;
}

export function readWorkspaceHash() {
  const [path, query = ''] = window.location.hash.slice(1).split('?');
  const [page, value = '', detail = ''] = path.split('/');
  try {
    const id = decodeURIComponent(value);
    const decodedDetail = decodeURIComponent(detail);
    const params = new URLSearchParams(query);
    const words = searchWords(params.get('find') ?? '');
    const search: SearchLocation | null = id && words.length && (page === 'history' || page === 'knowledge' || page === 'code')
      ? { page, id, words, inSource: page === 'code' && params.get('source') === '1' } : null;
    const relation: RelationNodeRef | null = page === 'relations' && decodedDetail && (id === 'log' || id === 'entry' || id === 'code')
      ? { kind: id, id: decodedDetail } : null;
    return { page, id, detail: decodedDetail, search, relation };
  } catch { return { page, id: '', detail: '', search: null, relation: null }; }
}
const initial = readWorkspaceHash();
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T12:00:00`).getTime());

export function practiceHref(outcomeId: string, practiceId: string): string {
  return '#path/' + encodeURIComponent(outcomeId) + '/' + encodeURIComponent(practiceId);
}

export function searchHref(href: string, query: string, inSource = false): string {
  const params = new URLSearchParams({ find: query.trim() });
  if (inSource) params.set('source', '1');
  return href + '?' + params;
}

export function relationHref({ kind, id }: RelationNodeRef): string {
  return '#relations/' + kind + '/' + encodeURIComponent(id);
}

export function knowledgeNetworkHref(entryId?: string): string {
  return entryId ? '#network/' + encodeURIComponent(entryId) : '#network';
}

export function hasWorkspaceEditor(page: string): boolean {
  return Boolean(document.getElementById(page)?.querySelector('form'));
}

export function workspaceResourceTarget(href: string) {
  return hasWorkspaceEditor(href.slice(1).split('/')[0]) ? { target: '_blank', rel: 'noopener' } : {};
}

interface WorkspaceStore {
  historyDate: string;
  entryId: string | null;
  codeVersionId: string | null;
  practiceTarget: { outcomeId: string; practiceId: string } | null;
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
  practiceTarget: initial.page === 'path' && initial.id && initial.detail
    ? { outcomeId: initial.id, practiceId: initial.detail } : null,
  search: initial.search,
  relationTarget: initial.relation,
  networkEntryRequest: initial.page === 'network' && initial.id ? { id: initial.id } : null,
  syncHash: () => {
    const { page, id, detail, search, relation } = readWorkspaceHash();
    const selection: Partial<WorkspaceStore> = { search, relationTarget: relation };
    if (page === 'network' && id && window.history.state?.knowledgeNetworkEntry !== id) {
      // Back and Forward revisit an existing entry, while a new link requests focus.
      window.history.replaceState({ ...window.history.state, knowledgeNetworkEntry: id }, '');
      selection.networkEntryRequest = { id };
    }
    if (page === 'knowledge' && id) selection.entryId = id;
    if (page === 'history' && isDate(id)) selection.historyDate = id;
    if (page === 'code') selection.codeVersionId = id || null;
    if (page === 'path') selection.practiceTarget = id && detail ? { outcomeId: id, practiceId: detail } : null;
    set(selection);
  },
  openLog: (date) => { set({ historyDate: date, search: null }); window.location.hash = `history/${date}`; },
  openEntry: (id) => { set({ entryId: id, search: null }); window.location.hash = `knowledge/${encodeURIComponent(id)}`; },
}));
