import { create } from 'zustand';
import { getTodayDate } from '../utils/storage';

export function readWorkspaceHash() {
  const [page, value = '', detail = ''] = window.location.hash.slice(1).split('/');
  try { return { page, id: decodeURIComponent(value), detail: decodeURIComponent(detail) }; }
  catch { return { page, id: '', detail: '' }; }
}
const initial = readWorkspaceHash();
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T12:00:00`).getTime());

export function practiceHref(outcomeId: string, practiceId: string): string {
  return '#path/' + encodeURIComponent(outcomeId) + '/' + encodeURIComponent(practiceId);
}

interface WorkspaceStore {
  historyDate: string;
  entryId: string | null;
  codeVersionId: string | null;
  practiceTarget: { outcomeId: string; practiceId: string } | null;
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
  syncHash: () => {
    const { page, id, detail } = readWorkspaceHash();
    if (page === 'knowledge' && id) set({ entryId: id });
    if (page === 'history' && isDate(id)) set({ historyDate: id });
    if (page === 'code') set({ codeVersionId: id || null });
    if (page === 'path') set({ practiceTarget: id && detail ? { outcomeId: id, practiceId: detail } : null });
  },
  openLog: (date) => { set({ historyDate: date }); window.location.hash = `history/${date}`; },
  openEntry: (id) => { set({ entryId: id }); window.location.hash = `knowledge/${encodeURIComponent(id)}`; },
}));
