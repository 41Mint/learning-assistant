import { create } from 'zustand';
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
    const params = new URLSearchParams(query);
    const words = searchWords(params.get('find') ?? '');
    const search: SearchLocation | null = id && words.length && (page === 'history' || page === 'knowledge' || page === 'code')
      ? { page, id, words, inSource: page === 'code' && params.get('source') === '1' } : null;
    return { page, id, detail: decodeURIComponent(detail), search };
  } catch { return { page, id: '', detail: '', search: null }; }
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

interface WorkspaceStore {
  historyDate: string;
  entryId: string | null;
  codeVersionId: string | null;
  practiceTarget: { outcomeId: string; practiceId: string } | null;
  search: SearchLocation | null;
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
  syncHash: () => {
    const { page, id, detail, search } = readWorkspaceHash();
    const selection: Partial<WorkspaceStore> = { search };
    if (page === 'knowledge' && id) selection.entryId = id;
    if (page === 'history' && isDate(id)) selection.historyDate = id;
    if (page === 'code') selection.codeVersionId = id || null;
    if (page === 'path') selection.practiceTarget = id && detail ? { outcomeId: id, practiceId: detail } : null;
    set(selection);
  },
  openLog: (date) => { set({ historyDate: date, search: null }); window.location.hash = `history/${date}`; },
  openEntry: (id) => { set({ entryId: id, search: null }); window.location.hash = `knowledge/${encodeURIComponent(id)}`; },
}));
