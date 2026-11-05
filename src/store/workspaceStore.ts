import { create } from 'zustand';
import { getTodayDate } from '../utils/storage';

export function readWorkspaceHash() {
  const [page, value = ''] = window.location.hash.slice(1).split('/');
  let id = '';
  try { id = decodeURIComponent(value); } catch { /* 无效地址由界面显示未找到。 */ }
  return { page, id };
}
const initial = readWorkspaceHash();
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T12:00:00`).getTime());

interface WorkspaceStore {
  historyDate: string;
  entryId: string | null;
  syncHash: () => void;
  openLog: (date: string) => void;
  openEntry: (id: string) => void;
}
export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  historyDate: initial.page === 'history' && isDate(initial.id) ? initial.id : getTodayDate(),
  entryId: initial.page === 'knowledge' && initial.id ? initial.id : null,
  syncHash: () => {
    const { page, id } = readWorkspaceHash();
    if (page === 'knowledge' && id) set({ entryId: id });
    if (page === 'history' && isDate(id)) set({ historyDate: id });
  },
  openLog: (date) => { set({ historyDate: date }); window.location.hash = `history/${date}`; },
  openEntry: (id) => { set({ entryId: id }); window.location.hash = `knowledge/${encodeURIComponent(id)}`; },
}));
