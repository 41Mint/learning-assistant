import { createContext } from 'react';
import type { GrowthDomain } from '../../types';
import type { ChatCode, ChatGrowthCard, ChatGrowthCards, ChatGrowthGroup } from '../../types/assistantChat';

export interface AssistantLogDraft { id: string; text: string }
export type AssistantLogKind = 'today' | 'history';
export type AssistantCodeExcerpt = ChatCode & { id: string; versionId: string };
export type AssistantCodeReference = AssistantCodeExcerpt | { kind: 'script'; id: string; versionId: string; path: string };
export type AssistantGrowthSelection = { id: string; kind: 'selection'; selection: ChatGrowthCards; cardIds: string[] };
export type AssistantGrowthReference = AssistantGrowthSelection
  | { id: string; kind: 'card'; card: ChatGrowthCard }
  | { id: string; kind: 'group'; group: ChatGrowthGroup };
export const isScriptReference = (reference?: AssistantCodeReference): reference is Extract<AssistantCodeReference, { kind: 'script' }> =>
  Boolean(reference && 'kind' in reference);

export const AssistantSlots = createContext<{
  today: HTMLDivElement | null;
  history: HTMLDivElement | null;
  close: () => void;
  setLogDraft: (kind: AssistantLogKind, value?: AssistantLogDraft) => void;
  askAboutCode: (reference: AssistantCodeReference) => void;
  askAboutGrowth: (reference: AssistantGrowthReference) => void;
  openGrowthRecommendations: (domain?: GrowthDomain) => void;
}>({
  today: null, history: null, close: () => {}, setLogDraft: () => {}, askAboutCode: () => {},
  openGrowthRecommendations: () => {},
  askAboutGrowth: () => {},
});
