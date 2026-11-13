import { createContext } from 'react';

export interface AssistantLogDraft { id: string; text: string }
export type AssistantLogKind = 'today' | 'history';

export const AssistantSlots = createContext<{
  today: HTMLDivElement | null;
  history: HTMLDivElement | null;
  close: () => void;
  setLogDraft: (kind: AssistantLogKind, value?: AssistantLogDraft) => void;
}>({
  today: null, history: null, close: () => {}, setLogDraft: () => {},
});
