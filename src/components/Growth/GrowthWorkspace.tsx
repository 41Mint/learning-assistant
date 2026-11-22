import { useContext, useEffect, useEffectEvent, useRef, useState } from 'react';
import type { DragEvent, MouseEvent } from 'react';
import { GROWTH_PRESETS } from '../../data/growthPresets';
import { useGrowthStore } from '../../store/growthStore';
import { GROWTH_DRAG_TYPE, useGrowthDragStore } from '../../store/growthDragStore';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import { exerciseHref, growthBoardHref, growthOutcomeHref, GROWTH_VIEWS, practiceHref, readWorkspaceHash, useWorkspaceStore, workspaceResourceTarget } from '../../store/workspaceStore';
import type { GrowthBoardView, GrowthGroup, GrowthOutcome, GrowthPractice, SavedExercise } from '../../types';
import { CHAT_GROUP_CARD_LIMIT, CHAT_GROUP_DESCRIPTION_LIMIT } from '../../types/assistantChat';
import { growthExercises, logLabel, orderGrowthCards } from '../../utils/growth';
import { growthDomainOptions, hasGrowthDomain } from '../../utils/growthDomains';
import { ADD_EXERCISE_LABEL, PRACTICE_IDEAS_LABEL, PRACTICE_RECORDS_LABEL, PRACTICE_VERIFICATION_LABEL } from '../../utils/growthLabels';
import { codeVersionHref, codeVersionLabel, practiceCodeIds } from '../../utils/projectCode';
import { generateId } from '../../utils/storage';
import { historyShortcut } from '../../utils/workspaceHistory';
import type { HistoryDirection } from '../../utils/workspaceHistory';
import SkillTree from '../SkillTree/SkillTree';
import GrowthPracticeForm from './GrowthPracticeForm';
import GrowthExerciseForm from './GrowthExerciseForm';
import GrowthExerciseActions from './GrowthExerciseActions';
import type { GrowthExerciseDraft } from './GrowthExerciseForm';
import GrowthCard from './GrowthCard';
import GrowthCardGrid from './GrowthCardGrid';
import useGrowthBoxSelection from './useGrowthBoxSelection';
import WorkspaceDialog from '../common/WorkspaceDialog';
import HistoryButtons from '../common/HistoryButtons';
import SegmentedControl from '../common/SegmentedControl';
import GrowthGroupStack from './GrowthGroupStack';
import GrowthFolder from './GrowthFolder';
import GrowthContextMenu from './GrowthContextMenu';
import type { GrowthMenu } from './GrowthContextMenu';
import type { GrowthCardAction } from './GrowthCard';
import type { GrowthDraft } from './GrowthPracticeForm';
import { AssistantSlots } from '../Assistant/assistantSlots';
import type { AssistantGrowthSelection } from '../Assistant/assistantSlots';

type SourceIds = Pick<GrowthPractice, 'logIds' | 'entryIds' | 'codeVersionIds'>;
const REMOVE_EXERCISE_LABEL = `移出「${PRACTICE_IDEAS_LABEL}」`;
type BoardDragEvent = Pick<DragEvent | globalThis.DragEvent, 'dataTransfer' | 'preventDefault' | 'stopPropagation'>;
type BoardMenuEvent = Pick<globalThis.MouseEvent, 'target' | 'shiftKey' | 'clientX' | 'clientY' | 'preventDefault'>;

function navigateGrowth(href: string, returnHref?: string) {
  if (window.location.hash === href) return;
  window.location.hash = href;
  if (returnHref) window.history.replaceState({ ...window.history.state, growthReturnHref: returnHref }, '');
}

function returnInGrowth(href: string) {
  if (window.history.state?.growthReturnHref === href) window.history.back();
  else window.location.replace(href);
}

function PracticeSources({ outcomeId, practice }: { outcomeId?: string; practice: SourceIds & { id?: string } }) {
  const logs = useStudyLogStore((state) => state.logs);
  const entries = useKnowledgeStore((state) => state.entries);
  const trashedEntries = useKnowledgeStore((state) => state.trash.entries);
  const code = useProjectCodeStore((state) => state.data);
  const trashedVersions = new Set(code.trash.versions.map(({ id }) => id));
  const linkedCodeIds = outcomeId && practice.id ? practiceCodeIds(outcomeId, { ...practice, id: practice.id }, code.links) : practice.codeVersionIds ?? [];
  const codeIds = linkedCodeIds.filter((id) => !trashedVersions.has(id));
  const hiddenEntryIds = new Set(trashedEntries.map(({ id }) => id));
  const entryIds = practice.entryIds.filter((id) => !hiddenEntryIds.has(id));
  if (practice.logIds.length === 0 && entryIds.length === 0 && codeIds.length === 0) return null;

  return (
    <ul className="growth-source-list" aria-label="关联资料">
      {practice.logIds.map((id) => {
        const log = logs.find((item) => item.id === id);
        const href = log && `#history/${log.date}`;
        return <li key={`log:${id}`}>{log && href ? <a href={href} {...workspaceResourceTarget(href)}>{logLabel(log)}</a> : '关联日志已不可用'}</li>;
      })}
      {entryIds.map((id) => {
        const entry = entries.find((item) => item.id === id);
        const href = `#knowledge/${encodeURIComponent(id)}`;
        return <li key={`entry:${id}`}>{entry ? <a href={href} {...workspaceResourceTarget(href)}>{entry.title}</a> : '关联词条已不可用'}</li>;
      })}
      {codeIds.map((id) => {
        const version = code.versions.find((item) => item.id === id);
        const project = version && code.projects.find((item) => item.id === version.projectId);
        return (
          <li key={`code:${id}`}>
            {version
              ? <a href={codeVersionHref(id)} {...workspaceResourceTarget(codeVersionHref(id))} title={codeVersionLabel(version, project?.name)}>代码 · {version.path}</a>
              : '关联代码已不可用'}
          </li>
        );
      })}
    </ul>
  );
}

export default function GrowthWorkspace({ active, draft, setDraft, exerciseDraft, setExerciseDraft }: {
  active: boolean;
  draft: GrowthDraft | null;
  setDraft: (draft: GrowthDraft | null) => void;
  exerciseDraft?: GrowthExerciseDraft;
  setExerciseDraft: (draft?: GrowthExerciseDraft) => void;
}) {
  const { outcomes, exercises, hiddenPresetIds, groups, cardOrder, boardOrder, isLoaded, error, loadGrowth, removePractice, removeExercises, restorePreset,
    saveExercise, saveGroup, removeGroup, moveCards, reorderCard, reorderBoard, arrangementHistory, applyArrangementHistory } = useGrowthStore();
  const [domain, setDomain] = useState('');
  const activeView = useWorkspaceStore((state) => state.growthView);
  const { openGrowthRecommendations, askAboutGrowth, close: closeAssistant } = useContext(AssistantSlots);
  const [notice, setNotice] = useState<{ text: string; saved: { outcomeId: string; id: string } } | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean }>();
  const [dialog, setDialog] = useState<{ kind: 'group' | 'move' | 'edit' | 'delete' | 'restore' | 'delete-group' | 'remove-exercise';
    id?: string; trigger?: HTMLButtonElement; practiceId?: string; cardIds?: string[]; exercise?: SavedExercise; description?: string }>();
  const [folderEntrance, setFolderEntrance] = useState<{ id: string; origin: DOMRect }>();
  const [folderFilter, setFolderFilter] = useState<{ id: string; domain: string }>();
  const openingSelection = useRef<{ href: string; ids: string[] }>(undefined);
  const [menu, setMenu] = useState<GrowthMenu>();
  const board = useRef<HTMLElement>(null);
  const addTrigger = useRef<HTMLButtonElement>(null);
  const exerciseTrigger = useRef<HTMLElement>(null);
  const [selection, setSelection] = useState('');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const groupId = useWorkspaceStore((state) => state.growthGroupId);
  const groupBoardView = useWorkspaceStore((state) => state.growthGroupBoardView);
  const cardId = useWorkspaceStore((state) => state.growthCardId);
  const exerciseId = useWorkspaceStore((state) => state.growthExerciseId);
  const group = groups.find(({ id }) => id === groupId);
  const practiceTarget = useWorkspaceStore((state) => state.practiceTarget);
  const outcomeId = useWorkspaceStore((state) => state.growthOutcomeId);
  const focusedPractice = useRef<HTMLLIElement>(null);
  const focusedOutcome = useRef<HTMLHeadingElement>(null);
  const editorTrigger = useRef<HTMLButtonElement>(null);
  const selectedDomain = outcomeId || cardId || exerciseId ? '' : domain;
  const domainOptions = growthDomainOptions([...(domain ? [domain] : []), ...[...outcomes, ...exercises].flatMap(({ domains }) => domains)]);

  useEffect(() => { loadGrowth(); }, [loadGrowth]);
  useEffect(() => {
    const close = () => {
      const pending = openingSelection.current;
      openingSelection.current = undefined;
      setMenu(undefined);
      setDialog(undefined);
      if (readWorkspaceHash().cardId) setFolderFilter(undefined);
      setSelectedCards(pending?.href === window.location.hash ? pending.ids : []);
    };
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, []);
  useEffect(() => {
    if (!feedback || feedback.error) return;
    const timer = window.setTimeout(() => setFeedback(undefined), 3000);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  useEffect(() => {
    if ((!outcomeId && !exerciseId) || !isLoaded || !active) return;
    const frame = window.requestAnimationFrame(() => {
      const target = focusedPractice.current ?? focusedOutcome.current;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active, exerciseId, outcomeId, practiceTarget, isLoaded]);

  const sortedOutcomes = outcomes
    .map((outcome) => ({ ...outcome, practices: [...outcome.practices].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)) }))
    .sort((a, b) => b.practices[0].date.localeCompare(a.practices[0].date) || b.practices[0].id.localeCompare(a.practices[0].id));
  const orderedOutcomes = orderGrowthCards(sortedOutcomes, cardOrder);
  const visibleOutcomes = orderedOutcomes.filter((outcome) => !selectedDomain || hasGrowthDomain(outcome.domains, selectedDomain));
  const completedIds = new Set(outcomes.map((outcome) => outcome.id));
  const exercisesById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const outcomeDescription = (outcome: GrowthOutcome) => outcome.description ?? exercisesById.get(outcome.id)?.action
    ?? GROWTH_PRESETS.find(({ id }) => id === outcome.id)?.cue;
  const activeOutcome = visibleOutcomes.find(({ id }) => id === outcomeId);
  const activePreset = GROWTH_PRESETS.find((item) => item.id === activeOutcome?.id);
  const activeExercise = activeOutcome && exercisesById.get(activeOutcome.id);
  const activeDescription = activeOutcome && outcomeDescription(activeOutcome);
  const canOpenForm = isLoaded && !error && !draft && !exerciseDraft;
  const boardView = activeView === 'topics' ? 'recent' : activeView;
  const boardHref = growthBoardHref(boardView);
  const allPending = orderGrowthCards(growthExercises({ exercises, hiddenPresetIds }).filter(({ id }) => !completedIds.has(id)), cardOrder);
  const cardOwners = new Map(groups.flatMap((item) => item.cardIds.map((id) => [id, item.id] as const)));
  const folderGroup = group && activeView !== 'topics' && !outcomeId && !exerciseId && (!cardId || group.cardIds.includes(cardId)) ? group : undefined;
  const openFolder = active && !draft && !exerciseDraft ? folderGroup : undefined;
  const showStacks = !outcomeId && !exerciseId && (!cardId || Boolean(folderGroup));
  const showCard = (id: string) => !cardOwners.has(id) || (id === cardId && !folderGroup);
  const completedCards = visibleOutcomes.filter(({ id }) => showCard(id));
  const pendingCards = allPending
    .filter(({ id, domains }) => showCard(id) && (!selectedDomain || hasGrowthDomain(domains, selectedDomain)));
  const activeExerciseDetails = allPending.find(({ id }) => id === exerciseId);
  const detailCardId = activeOutcome?.id ?? activeExerciseDetails?.id;
  const detailGroupId = detailCardId ? cardOwners.get(detailCardId) : undefined;
  const detailGroup = groups.find(({ id }) => id === detailGroupId);
  const returnBoard = detailGroup?.id === groupId ? groupBoardView ?? boardView : boardView;
  const returnHref = detailGroup ? growthBoardHref(returnBoard, detailGroup.id) : boardHref;
  const stackMembers = new Map([...allPending, ...outcomes].map((card) => [card.id, {
    id: card.id, title: card.title, domains: card.domains, complete: 'practices' in card,
    description: 'practices' in card ? outcomeDescription(card) ?? ''
      : [card.action, card.done].filter(Boolean).join('\n'),
  }]));
  const folderMembers = openFolder?.cardIds.flatMap((id) => stackMembers.get(id) ?? []) ?? [];
  const folderDomains = domainOptions.filter((name) => folderMembers.some(({ domains }) => hasGrowthDomain(domains, name)));
  const folderDomain = folderFilter && folderFilter.id === openFolder?.id && folderDomains.includes(folderFilter.domain)
    ? folderFilter.domain : '';
  const inFolder = ({ id, domains }: { id: string; domains: string[] }) => openFolder?.cardIds.includes(id)
    && (!folderDomain || hasGrowthDomain(domains, folderDomain));
  const folderOutcomes = orderedOutcomes.filter(inFolder);
  const folderExercises = allPending.filter(inFolder);
  const mixedFolder = folderOutcomes.length > 0 && folderExercises.length > 0;
  const selectableOnBoard = boardView === 'recent' ? completedCards : pendingCards;
  const visibleSelectionCards = (openFolder ? [...folderOutcomes, ...folderExercises]
    : activeOutcome || activeExerciseDetails ? [] : selectableOnBoard).map(({ id }) => id);
  const selectionIds = selectedCards.filter((id) => visibleSelectionCards.includes(id));
  const applyBoxSelection = (ids: string[], extend: boolean) =>
    setSelectedCards(extend ? [...new Set([...selectionIds, ...ids])] : ids);
  const boxSelection = useGrowthBoxSelection(active && canOpenForm && !openFolder && !activeOutcome &&
    !activeExerciseDetails && activeView !== 'topics', applyBoxSelection);
  const stacks = showStacks ? groups.flatMap((item) => {
    const members = item.cardIds.flatMap((id) => stackMembers.get(id) ?? []);
    const matchesView = members.some(({ complete, domains }) =>
      complete === (activeView === 'recent') && (!selectedDomain || hasGrowthDomain(domains, selectedDomain)));
    return matchesView ? [{ group: item, members }] : [];
  }) : [];
  const editExercise = (trigger: HTMLElement, exercise?: SavedExercise, groupId?: string) => {
    exerciseTrigger.current = trigger;
    const initialDomain = groupId ? folderDomain : domain;
    setExerciseDraft({ creating: !exercise, groupId, exercise: exercise ?? {
      id: generateId(), title: '', domains: initialDomain ? [initialDomain] : [], action: '', done: '',
      sources: { logIds: [], entryIds: [], codeVersionIds: [] },
    } });
  };
  const recordExercise = (exercise: SavedExercise, trigger: HTMLButtonElement) => {
    begin({ outcome: { id: exercise.id, title: exercise.title, domains: exercise.domains, description: exercise.action },
      preset: GROWTH_PRESETS.some(({ id }) => id === exercise.id), suggestedSources: exercise.sources }, trigger);
  };

  const begin = (next: GrowthDraft, trigger?: HTMLButtonElement) => {
    editorTrigger.current = trigger ?? null;
    setDialog(undefined);
    setDraft(next);
    setNotice(null);
    setFeedback(undefined);
  };

  const closeEditor = (savedId?: string) => {
    if (!draft) return;
    const outcomeId = draft.outcome.id;
    setDraft(null);
    if (savedId) {
      setDomain('');
      setNotice({ text: '实践已保存。', saved: { outcomeId, id: savedId } });
      const ownerId = cardOwners.get(outcomeId) ?? draft.groupId;
      const href = practiceHref(outcomeId, savedId, ownerId, folderGroup ? boardView : groupBoardView ?? undefined);
      if (window.location.hash !== href) navigateGrowth(href, folderGroup && growthBoardHref(boardView, folderGroup.id));
      else window.requestAnimationFrame(() => focusedPractice.current?.focus());
    } else {
      window.requestAnimationFrame(() => editorTrigger.current?.focus());
    }
  };

  const choosePractice = (kind: 'edit' | 'delete', outcome: GrowthOutcome, trigger: HTMLButtonElement, practice?: GrowthPractice) => {
    if (kind === 'edit' && outcome.practices.length === 1) {
      begin({ outcome, preset: GROWTH_PRESETS.some(({ id }) => id === outcome.id), practice: outcome.practices[0] }, trigger);
      return;
    }
    setSelection((practice ?? outcome.practices[0]).id);
    setDialog({ kind, id: outcome.id, trigger, practiceId: practice?.id });
  };
  const moveAction = (ids: string[]): GrowthCardAction => ({ label: '移到卡组', run: canOpenForm ? () => {
    const owner = cardOwners.get(ids[0]);
    setSelection(ids.every((id) => cardOwners.get(id) === owner) ? owner ?? '' : '');
    setDialog({ kind: 'move', cardIds: ids });
  } : undefined });
  const dialogOutcome = sortedOutcomes.find(({ id }) => id === dialog?.id);
  const dialogPractice = dialogOutcome?.practices.find(({ id }) => id === selection);
  const returnsToTry = dialogOutcome && (exercisesById.has(dialogOutcome.id) || GROWTH_PRESETS.some(({ id }) => id === dialogOutcome.id));
  const reportError = (error: unknown) => setFeedback({ text: error instanceof Error ? error.message : '操作失败，请重试。', error: true });
  const groupEditor = (itemId?: string) => {
    const item = groups.find(({ id }) => id === itemId);
    setSelection(item?.name ?? '');
    setDialog({ kind: 'group', id: itemId, description: item?.description });
  };
  const newOutcome = (trigger?: HTMLButtonElement, groupId?: string) => {
    const initialDomain = groupId ? folderDomain : selectedDomain;
    begin({ outcome: { id: generateId(), title: '', domains: initialDomain ? [initialDomain] : [] }, preset: false, groupId }, trigger);
  };
  const dialogGroup = groups.find(({ id }) => id === dialog?.id);
  const dialogExercises = dialog?.kind === 'remove-exercise'
    ? allPending.filter(({ id }) => dialog.cardIds?.includes(id)) : [];
  const removeFromGroup = (ids: string[]) => {
    try {
      moveCards(ids, null);
      setSelectedCards([]);
      setFeedback({ text: ids.length > 1 ? `已将 ${ids.length} 张卡片移出卡组。` : '已移出卡组。' });
    } catch (error) { reportError(error); }
  };
  const groupActions = (ids: string[], ownerId?: string): GrowthCardAction[] => [moveAction(ids), ...(ownerId ? [{
    label: '移出当前卡组', run: canOpenForm ? () => removeFromGroup(ids) : undefined,
  }] : [])];
  const removeTryAction = (ids: string[]): GrowthCardAction => ({ label: REMOVE_EXERCISE_LABEL,
    run: canOpenForm ? () => setDialog({ kind: 'remove-exercise', cardIds: ids }) : undefined });
  const acceptDrop = (event: BoardDragEvent, targetGroup?: string, targetCard?: string) => {
    if (!event.dataTransfer?.types.includes(GROWTH_DRAG_TYPE)) return;
    event.stopPropagation();
    if (!canOpenForm) return;
    const transfer = useGrowthDragStore.getState().drag;
    if (!transfer || 'groupId' in transfer) return;
    if ('cardId' in transfer) {
      if (transfer.cardId === targetCard) return;
      if (targetGroup && cardOwners.get(transfer.cardId) === targetGroup) return;
      if (!targetGroup && !targetCard) return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    return transfer;
  };
  const dropOn = (event: BoardDragEvent, targetGroup?: string, targetCard?: string) => {
    const transfer = acceptDrop(event, targetGroup, targetCard);
    if (!transfer) return;
    useGrowthDragStore.setState({ drag: undefined });
    try {
      if ('exercise' in transfer) {
        const { exercise } = transfer;
        if (targetCard && !targetGroup) {
          closeAssistant();
          setSelection('');
          setDialog({ kind: 'group', cardIds: [targetCard, exercise.id], exercise });
        } else if (!targetGroup && activeView === 'recent') {
          closeAssistant();
          begin({ outcome: { id: exercise.id, title: exercise.title, domains: exercise.domains, description: exercise.action },
            preset: false, suggestedSources: exercise.sources, exercise });
        } else if (saveExercise(exercise, targetGroup)) {
          setFeedback({ text: targetGroup ? `已收藏到卡组的「${PRACTICE_IDEAS_LABEL}」。` : `已加入「${PRACTICE_IDEAS_LABEL}」。` });
        }
      } else if (targetGroup) {
        moveCards([transfer.cardId], targetGroup);
        setFeedback({ text: '已移到所选卡组。' });
      } else if (targetCard) {
        setSelection('');
        setDialog({ kind: 'group', cardIds: [targetCard, transfer.cardId] });
      }
    } catch (error) { reportError(error); }
  };
  const cardDrop = (id: string) => {
    const owner = cardOwners.get(id);
    return {
      drag: canOpenForm ? { cardId: id } : undefined,
      onDragOver: (event: DragEvent<HTMLElement>) => {
        const transfer = acceptDrop(event, owner, id);
        if (transfer) event.currentTarget.dataset.dropIntent = owner ? 'move' : 'group';
        else delete event.currentTarget.dataset.dropIntent;
      },
      onDrop: (event: DragEvent<HTMLElement>) => dropOn(event, owner, id),
    };
  };
  const reorder = (source: string, anchor: string, side: 'before' | 'after', view?: GrowthBoardView) => {
    try {
      if (view && showStacks && activeView === view) {
        const cards = view === 'recent' ? orderedOutcomes : allPending;
        const tiles = [
          ...groups.filter((item) => item.cardIds.some((id) => stackMembers.get(id)?.complete === (view === 'recent')))
            .map(({ id }) => ({ id: `group:${id}` })),
          ...cards.filter(({ id }) => !cardOwners.has(id)).map(({ id }) => ({ id: `card:${id}` })),
        ];
        reorderBoard(view, orderGrowthCards(tiles, boardOrder?.[view]).map(({ id }) => id), source, anchor, side);
      } else {
        const targetId = anchor.slice('card:'.length);
        const cards = completedIds.has(targetId) ? orderedOutcomes : allPending;
        reorderCard(cards.map(({ id }) => id), source.slice('card:'.length), targetId, side);
      }
    }
    catch (error) { reportError(error); }
  };
  const folderDragOutside = (event: BoardDragEvent, groupId: string) => {
    const transfer = useGrowthDragStore.getState().drag;
    if (!canOpenForm || !event.dataTransfer?.types.includes(GROWTH_DRAG_TYPE) || !transfer || !('cardId' in transfer)
      || cardOwners.get(transfer.cardId) !== groupId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    return transfer.cardId;
  };
  const historyEnabled = canOpenForm && activeView !== 'topics' && !dialog;
  const historyAvailable = { undo: arrangementHistory.undo.length > 0, redo: arrangementHistory.redo.length > 0 };
  const performHistory = (direction: HistoryDirection) => {
    if (!active || !historyEnabled || document.querySelector('dialog:modal:not(.growth-folder)')) return false;
    try {
      if (!applyArrangementHistory(direction)) return false;
      const nextGroups = useGrowthStore.getState().groups;
      if (openFolder && !nextGroups.some(({ id }) => id === openFolder.id)) returnInGrowth(boardHref);
      setSelectedCards([]);
      setFeedback({ text: direction === 'undo' ? '已撤销卡片整理。' : '已重做卡片整理。' });
    } catch (error) { reportError(error); }
    return true;
  };
  const onHistoryKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.target instanceof Element && event.target.closest('dialog[open]:not(.growth-folder)')) return;
    const direction = historyShortcut(event);
    if (direction && performHistory(direction)) event.preventDefault();
  });
  useEffect(() => {
    if (!active) return;
    const shortcut = (event: KeyboardEvent) => onHistoryKey(event);
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [active]);
  const historyTools = <div className="growth-history-tools" role="group" aria-label="整理历史">
    <HistoryButtons available={historyAvailable} labels={{ undo: '撤销整理', redo: '重做整理' }}
      disabled={!historyEnabled} onHistory={performHistory} />
  </div>;
  const openGroup = (id: string, trigger: HTMLElement, selected: string[] = []) => {
    const href = growthBoardHref(boardView, id);
    setFolderEntrance({ id, origin: trigger.getBoundingClientRect() });
    setFolderFilter(undefined);
    if (window.location.hash === href) setSelectedCards(selected);
    else {
      openingSelection.current = { href, ids: selected };
      navigateGrowth(href, window.location.hash === boardHref ? boardHref : undefined);
    }
  };
  const openFolderCard = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!openFolder || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigateGrowth(event.currentTarget.hash, growthBoardHref(boardView, openFolder.id));
  };
  const cardSummaries = (ids: string[]) => {
    const members = ids.flatMap((id) => stackMembers.get(id) ?? []);
    return { totalCards: members.length,
      cards: members.slice(0, CHAT_GROUP_CARD_LIMIT).map(({ title, domains, description, complete }) => ({
        title: title.trim().slice(0, 100), domains, description: description.trim().slice(0, CHAT_GROUP_DESCRIPTION_LIMIT), completed: complete,
      })),
    };
  };
  const askAboutGroup = (item: GrowthGroup) => {
    askAboutGrowth({ id: item.id, kind: 'group', group: { name: item.name, ...cardSummaries(item.cardIds) } });
  };
  const selectionContext: AssistantGrowthSelection | undefined = selectionIds.length > 1 && selectionIds.length <= CHAT_GROUP_CARD_LIMIT
    ? { id: JSON.stringify([...selectionIds].sort()), kind: 'selection', selection: cardSummaries(selectionIds), cardIds: selectionIds } : undefined;
  const dismissFolderForAsk = () => {
    if (openFolder) returnInGrowth(boardHref);
  };
  const askSelectedCards = () => {
    if (!selectionContext) return;
    dismissFolderForAsk();
    askAboutGrowth(selectionContext);
  };
  const batch = selectionIds.length > 1 ? {
    count: selectionIds.length,
    actions: [
      ...groupActions(selectionIds, openFolder?.id),
      ...(selectionIds.every((id) => !completedIds.has(id)) ? [removeTryAction(selectionIds)] : []),
      { label: '询问智能体', run: selectionContext ? askSelectedCards : undefined },
    ],
  } : undefined;
  const selectionProps = (id: string) => ({
    selected: selectionIds.includes(id),
    batch,
    onSelect: (extend: boolean) => setSelectedCards(!extend ? [id] : selectionIds.includes(id)
      ? selectionIds.filter((selected) => selected !== id) : [...selectionIds, id]),
  });
  const selectionBar = selectionIds.length > 0 && <div className="growth-selection" role="group" aria-label="所选卡片">
    <small role="status">已选 {selectionIds.length} 张{selectionIds.length > CHAT_GROUP_CARD_LIMIT && ` · 每次最多询问 ${CHAT_GROUP_CARD_LIMIT} 张`}</small>
    {selectionIds.length > 1 && <button type="button" className="growth-board-group-button" disabled={!selectionContext}
      onClick={askSelectedCards}>询问智能体</button>}
    <button type="button" className="knowledge-text-button" onClick={() => setSelectedCards([])}>取消选择</button>
  </div>;
  const showGroupMenu = (event: MouseEvent<HTMLElement>, item: GrowthGroup) => {
    if (event.shiftKey && event.button === 2) return;
    event.preventDefault();
    event.stopPropagation();
    const trigger = event.currentTarget;
    const cover = trigger.closest<HTMLElement>('.growth-group-stack') ?? trigger;
    const box = trigger.getBoundingClientRect();
    const members = item.cardIds.filter((id) => stackMembers.has(id));
    const fromButton = event.type === 'click';
    setMenu({ x: fromButton ? box.left : event.clientX || box.left, y: fromButton ? box.bottom + 4 : event.clientY || box.bottom,
      title: '卡组操作', trigger, keyboard: event.button !== 2,
      actions: [
        { label: '打开卡组', run: () => openGroup(item.id, cover) },
        ...(members.length ? [{ label: '选中组内卡片', run: () => openGroup(item.id, cover, members) }] : []),
        { label: '询问智能体', run: () => askAboutGroup(item) },
        { label: '编辑卡组', run: () => groupEditor(item.id) },
        { label: '删除卡组', danger: true, run: () => setDialog({ kind: 'delete-group', id: item.id }) },
      ] });
  };
  const onBoardMenu = (event: BoardMenuEvent, trigger: HTMLElement) => {
    if (!canOpenForm || !(event.target instanceof Element) || event.target.closest('article, a, button, select, .growth-board-toolbar') || event.shiftKey) return;
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, title: '成长记录操作', actions: [
      activeView === 'try' ? { label: ADD_EXERCISE_LABEL, run: () => editExercise(addTrigger.current ?? trigger) }
        : { label: '记录自定义成果', run: () => newOutcome() },
      { label: '让智能体推荐', run: () => openGrowthRecommendations(domain) },
      { label: '新建卡组', run: () => { setSelection(''); setDialog({ kind: 'group' }); } },
      ...(historyAvailable.undo ? [{ label: '撤销整理', run: () => performHistory('undo') }] : []),
      ...(historyAvailable.redo ? [{ label: '重做整理', run: () => performHistory('redo') }] : []),
    ] });
  };
  const onPageBackground = useEffectEvent((event: globalThis.MouseEvent) => {
    const surface = board.current;
    if (!surface || surface.hidden || !(event.target instanceof Element) ||
      !event.target.matches('.app-shell, .app-content, main, #path, .growth-workspace')) return;
    if (event.type === 'contextmenu') onBoardMenu(event, surface);
    else if (event instanceof globalThis.DragEvent) {
      if (event.type === 'drop') dropOn(event);
      else acceptDrop(event);
    }
  });
  useEffect(() => {
    const shell = board.current?.closest('.app-shell');
    if (!active || !shell) return;
    const events = ['contextmenu', 'dragover', 'drop'] as const;
    const handle = (event: Event) => { if (event instanceof globalThis.MouseEvent) onPageBackground(event); };
    for (const event of events) shell.addEventListener(event, handle);
    return () => { for (const event of events) shell.removeEventListener(event, handle); };
  }, [active]);
  const stackTiles = stacks.map(({ group: item, members }) => ({ id: `group:${item.id}`, node: <GrowthGroupStack key={item.id} group={item}
    href={growthBoardHref(boardView, item.id)}
    count={members.length} domains={domainOptions.filter((domain) => members.some((member) => hasGrowthDomain(member.domains, domain)))}
    canDrag={canOpenForm} menuOpen={menu?.trigger?.closest<HTMLElement>('[data-growth-tile]')?.dataset.growthTile === `group:${item.id}`}
    onDragOver={(event) => { acceptDrop(event, item.id); }} onDrop={(event) => dropOn(event, item.id)}
    onOpen={(event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      openGroup(item.id, event.currentTarget);
    }}
    onMenu={(event) => showGroupMenu(event, item)} /> }));
  const renderOutcome = (outcome: GrowthOutcome, fromBoard?: GrowthBoardView) => {
    const latest = outcome.practices[0];
    const preset = GROWTH_PRESETS.find((item) => item.id === outcome.id);
    const description = outcomeDescription(outcome);
    const note = latest.note.trim();
    const ownerId = cardOwners.get(outcome.id);
    const href = growthOutcomeHref(outcome.id, ownerId, fromBoard);
    return <GrowthCard key={outcome.id} id={outcome.id} href={href} highlighted={active && cardId === outcome.id}
      {...cardDrop(outcome.id)} {...selectionProps(outcome.id)}
      onOpen={fromBoard ? openFolderCard : undefined}
      onAsk={dismissFolderForAsk}
      card={{ title: outcome.title, domains: outcome.domains, description: [description, note].filter(Boolean).join('\n') }}
      actions={[
        { label: '编辑实践', run: canOpenForm ? (trigger) => choosePractice('edit', outcome, trigger) : undefined },
        { label: '删除实践', run: canOpenForm ? (trigger) => choosePractice('delete', outcome, trigger) : undefined },
        ...groupActions([outcome.id], ownerId),
      ]}
      recordLabel="追加实践" onRecord={canOpenForm ? (trigger) => begin({ outcome, preset: Boolean(preset) }, trigger) : undefined}>
      {description && <p className="growth-card-summary">{description}</p>}
      {note && <p className="growth-card-summary">{note}</p>}
      <small className="growth-muted">{outcome.practices.length} 次实践 · <time dateTime={latest.date}>{latest.date}</time></small>
    </GrowthCard>;
  };
  const renderExercise = (exercise: SavedExercise, fromBoard?: GrowthBoardView) => {
    const { id, title, domains, action, done } = exercise;
    const ownerId = cardOwners.get(id);
    return <GrowthCard key={id} id={id} href={exerciseHref(id, ownerId, fromBoard)} highlighted={active && cardId === id}
      {...cardDrop(id)} {...selectionProps(id)}
      onOpen={fromBoard ? openFolderCard : undefined}
      onAsk={dismissFolderForAsk}
      card={{ title, domains, description: done ? `${action}\n${PRACTICE_VERIFICATION_LABEL}：${done}` : action }} recordLabel="我做到了"
      actions={[{ label: '编辑卡片', run: canOpenForm ? (trigger) => editExercise(trigger, exercise) : undefined },
        ...groupActions([id], ownerId), removeTryAction([id])]}
      onRecord={canOpenForm ? (trigger) => recordExercise(exercise, trigger) : undefined}>
      <p className="growth-card-summary">{action || done}</p>
    </GrowthCard>;
  };
  const boardTiles = (view: GrowthBoardView) => {
    const cards = view === 'recent'
      ? completedCards.map((item) => ({ id: `card:${item.id}`, node: renderOutcome(item) }))
      : pendingCards.map((item) => ({ id: `card:${item.id}`, node: renderExercise(item) }));
    return (showStacks && activeView === view ? orderGrowthCards([...stackTiles, ...cards], boardOrder?.[view]) : cards).map(({ node }) => node);
  };
  const backToCards = <a className="growth-back-link" href={returnHref} onClick={(event) => {
    if (!detailGroup || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    returnInGrowth(returnHref);
  }}>{detailGroup ? `← 返回${detailGroup.name}` : '← 返回卡片'}</a>;

  return (
    <div className="growth-workspace">
      {exerciseDraft && <section className="module-card growth-editor" aria-label="卡片编辑">
        <GrowthExerciseForm {...exerciseDraft} onCancel={() => {
          setExerciseDraft(undefined);
          window.requestAnimationFrame(() => exerciseTrigger.current?.focus());
        }} onSaved={() => {
          setExerciseDraft(undefined);
          const href = exerciseHref(exerciseDraft.exercise.id, cardOwners.get(exerciseDraft.exercise.id) ?? exerciseDraft.groupId,
            folderGroup ? boardView : groupBoardView ?? undefined);
          if (window.location.hash !== href) navigateGrowth(href, folderGroup && growthBoardHref(boardView, folderGroup.id));
          else window.requestAnimationFrame(() => focusedOutcome.current?.focus());
        }} />
      </section>}
      {draft && (
        <section className="module-card growth-editor" aria-label="实践编辑">
          <GrowthPracticeForm draft={draft} onClose={closeEditor} />
        </section>
      )}
      <section ref={board} className="growth-board" aria-label={boardView === 'try' ? PRACTICE_IDEAS_LABEL : PRACTICE_RECORDS_LABEL}
        hidden={Boolean(draft || exerciseDraft) || activeView === 'topics'}
        {...boxSelection.handlers}
        onClick={(event) => { if (event.target instanceof Element && !event.target.closest('.growth-card-slot, article, a, button, .growth-board-toolbar, .growth-selection')) setSelectedCards([]); }}
        onContextMenu={(event) => onBoardMenu(event, event.currentTarget)}
        onDragOver={(event) => { if (!(event.target instanceof Element && event.target.closest('.growth-board-toolbar, article, a'))) acceptDrop(event); }}
        onDrop={(event) => { if (!(event.target instanceof Element && event.target.closest('.growth-board-toolbar, article, a'))) dropOn(event); }}>
        <div className="growth-board-toolbar">
          <SegmentedControl as="nav" label="实践卡片视图">
            {GROWTH_VIEWS.map((view) => <a key={view.id} href={view.href} aria-current={boardView === view.id ? 'page' : undefined}>{view.label}</a>)}
          </SegmentedControl>
          <label className="growth-filter">按领域筛选
            <select value={selectedDomain} onChange={(event) => {
              setSelectedCards([]);
              setDomain(event.target.value);
              if (outcomeId || cardId || exerciseId) window.location.hash = boardHref;
            }}>
              <option value="">全部领域</option>
              {domainOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <select className="growth-group-picker" aria-label="打开卡组" value="" disabled={!groups.length} onChange={(event) => {
            if (event.target.value) openGroup(event.target.value, event.currentTarget);
          }}>
            <option value="" disabled>卡组</option>
            {groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button type="button" className="growth-board-group-button" onClick={() => groupEditor()} disabled={!canOpenForm}>新建卡组</button>
          {activeView !== 'try' ? (
            <button type="button" className="note-button growth-board-primary" disabled={!canOpenForm}
              onClick={(event) => newOutcome(event.currentTarget)}>记录自定义成果</button>
          ) : (
            <GrowthExerciseActions triggerRef={addTrigger} disabled={!canOpenForm}
              onWrite={editExercise} onRecommend={() => openGrowthRecommendations(domain)} />
          )}
          {activeView === 'try' && hiddenPresetIds.length > 0 && <button type="button" className="growth-board-group-button" disabled={!canOpenForm}
            onClick={() => { setSelection(hiddenPresetIds[0]); setDialog({ kind: 'restore' }); }}>恢复内置练习</button>}
          {historyTools}
        </div>
        {!openFolder && selectionBar}
        {error && <p role="alert">{error}</p>}
        {feedback && <p className="growth-muted" role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
        {boardView === 'recent' && (
          <div>
            {!activeOutcome && isLoaded && !error && completedCards.length === 0 && stacks.length === 0 && (
              <p className="growth-muted">{selectedDomain ? '当前筛选下没有实践记录。' : `还没有实践记录。可以记录自己的成果，或从「${PRACTICE_IDEAS_LABEL}」选一项练习。`}</p>
            )}
            {activeOutcome ? (
              <article className="growth-card growth-outcome growth-detail" aria-label={activeOutcome.title}>
                {backToCards}
                <h2 ref={focusedOutcome} tabIndex={-1}>{activeOutcome.title}</h2>
                <small className="growth-muted">{activeOutcome.practices.length} 次实践</small>
                {activeDescription && <p className="growth-note">{activeDescription}</p>}
                {activeExercise?.done && <p className="growth-note"><strong>{PRACTICE_VERIFICATION_LABEL}</strong> {activeExercise.done}</p>}
                <ol className="growth-practices">
                  {activeOutcome.practices.map((practice) => {
                    const focused = practiceTarget?.outcomeId === activeOutcome.id && practiceTarget.practiceId === practice.id;
                    return (
                      <li key={practice.id} ref={focused ? focusedPractice : undefined} tabIndex={focused ? -1 : undefined} data-practice-focus={focused || undefined}>
                        <div className="growth-heading">
                          <div>
                            <time dateTime={practice.date}>{practice.date}</time>
                            {notice?.saved?.outcomeId === activeOutcome.id && notice.saved.id === practice.id && (
                              <span className="growth-save-status" role="status">{notice.text}</span>
                            )}
                          </div>
                          <div>
                            <button type="button" className="knowledge-text-button" disabled={!canOpenForm} onClick={(event) => begin({ outcome: activeOutcome, preset: Boolean(activePreset), practice }, event.currentTarget)}>编辑实践</button>
                            <button type="button" className="knowledge-text-button danger" disabled={!canOpenForm}
                              onClick={(event) => choosePractice('delete', activeOutcome, event.currentTarget, practice)}>删除实践</button>
                          </div>
                        </div>
                        {practice.note && <p className="growth-note">{practice.note}</p>}
                        <PracticeSources outcomeId={activeOutcome.id} practice={practice} />
                      </li>
                    );
                  })}
                </ol>
              </article>
            ) : <GrowthCardGrid canReorder={canOpenForm} onReorder={(source, anchor, side) => reorder(source, anchor, side, 'recent')}>
              {boardTiles('recent')}
            </GrowthCardGrid>}
          </div>
        )}
        {boardView === 'try' && (
          <div>
            {!activeExerciseDetails && isLoaded && !error && pendingCards.length === 0 && stacks.length === 0 &&
              <p className="growth-muted">当前筛选下「{PRACTICE_IDEAS_LABEL}」里没有卡片。</p>}
            {activeExerciseDetails ? <article className="growth-card growth-outcome growth-detail" aria-label={activeExerciseDetails.title}>
              {backToCards}
              <div className="growth-heading">
                <h2 ref={focusedOutcome} tabIndex={-1}>{activeExerciseDetails.title}</h2>
                <div className="code-actions">
                  <button type="button" className="note-button secondary" disabled={!canOpenForm}
                    onClick={(event) => editExercise(event.currentTarget, activeExerciseDetails)}>编辑卡片</button>
                  <button type="button" className="note-button" disabled={!canOpenForm}
                    onClick={(event) => recordExercise(activeExerciseDetails, event.currentTarget)}>我做到了</button>
                </div>
              </div>
              <div className="growth-card-meta">{activeExerciseDetails.domains.map((tag) => <span key={tag} className="growth-domain" data-domain={tag}>{tag}</span>)}</div>
              {activeExerciseDetails.action && <p className="growth-note">{activeExerciseDetails.action}</p>}
              {activeExerciseDetails.done && <p className="growth-note"><strong>{PRACTICE_VERIFICATION_LABEL}</strong> {activeExerciseDetails.done}</p>}
              <PracticeSources practice={activeExerciseDetails.sources} />
            </article> : <GrowthCardGrid canReorder={canOpenForm} onReorder={(source, anchor, side) => reorder(source, anchor, side, 'try')}>
              {boardTiles('try')}
            </GrowthCardGrid>}
          </div>
        )}
        {boxSelection.rectangle}
      </section>
      {active && menu && <GrowthContextMenu menu={menu} onClose={() => setMenu(undefined)} />}
      {openFolder && <GrowthFolder key={openFolder.id} name={openFolder.name} description={openFolder.description}
        origin={folderEntrance?.id === openFolder.id ? folderEntrance.origin : undefined} historyTools={historyTools}
        onSelectCards={applyBoxSelection}
        onClose={() => returnInGrowth(boardHref)} onManage={() => groupEditor(openFolder.id)}
        onDragOutside={(event) => Boolean(folderDragOutside(event, openFolder.id))}
        onDropOutside={(event) => {
          const id = folderDragOutside(event, openFolder.id);
          if (!id) return;
          useGrowthDragStore.setState({ drag: undefined });
          removeFromGroup([id]);
        }}>
        <details className="growth-folder-tools">
          <summary>组内操作</summary>
          <div className="growth-folder-controls">
            {folderDomains.length > 0 && <label className="growth-filter">按领域筛选
              <select value={folderDomain} onChange={(event) => {
                setSelectedCards([]);
                setFolderFilter({ id: openFolder.id, domain: event.target.value });
              }}>
                <option value="">全部领域</option>
                {folderDomains.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>}
            <button type="button" className="growth-board-group-button" disabled={!canOpenForm}
              onClick={(event) => newOutcome(event.currentTarget, openFolder.id)}>记录自定义成果</button>
            <GrowthExerciseActions side disabled={!canOpenForm}
              onWrite={(trigger) => editExercise(trigger, undefined, openFolder.id)}
              onRecommend={() => openGrowthRecommendations(folderDomain, openFolder.id)} />
          </div>
        </details>
        {selectionBar}
        {feedback && <p className="growth-muted" role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
        {folderOutcomes.length > 0 && <>
          {mixedFolder && <h3>{PRACTICE_RECORDS_LABEL}</h3>}
          <GrowthCardGrid canReorder={canOpenForm} onReorder={reorder}>{folderOutcomes.map((item) => renderOutcome(item, boardView))}</GrowthCardGrid>
        </>}
        {folderExercises.length > 0 && <>
          {mixedFolder && <h3>{PRACTICE_IDEAS_LABEL}</h3>}
          <GrowthCardGrid canReorder={canOpenForm} onReorder={reorder}>{folderExercises.map((item) => renderExercise(item, boardView))}</GrowthCardGrid>
        </>}
        {folderOutcomes.length === 0 && folderExercises.length === 0 && <p className="growth-muted">
          {folderDomain ? '当前领域下没有卡片。' : '这个卡组暂无可显示的卡片。'}
        </p>}
      </GrowthFolder>}
      {active && dialog?.kind === 'restore' && <WorkspaceDialog title="恢复内置练习" action="恢复"
        onClose={() => setDialog(undefined)} onSave={() => {
          restorePreset(selection);
          setFeedback({ text: '已恢复内置练习。' });
        }}>
        <label className="growth-field">内置练习<select value={selection} onChange={(event) => setSelection(event.target.value)}>
          {GROWTH_PRESETS.filter(({ id }) => hiddenPresetIds.includes(id)).map(({ id, title }) =>
            <option key={id} value={id}>{exercisesById.get(id)?.title ?? title}</option>)}
        </select></label>
      </WorkspaceDialog>}
      {active && dialog?.kind === 'group' && <WorkspaceDialog title={dialog.id ? '管理卡组' : '新建卡组'} action={dialog.id ? '保存卡组' : '创建卡组'}
        valid={Boolean(selection.trim())} onClose={() => setDialog(undefined)} onSave={() => {
          const ids = dialog.cardIds ?? [];
          if (!ids.every((id) => id === dialog.exercise?.id || stackMembers.has(id))) {
            throw new Error('有卡片已离开当前视图，请重新选择。');
          }
          saveGroup(selection, dialog.id, dialog.cardIds, dialog.exercise, dialog.description);
          if (!dialog.id) {
            if (ids.length) setSelectedCards([]);
            setFeedback({ text: ids.length ? `已创建卡组，并移入 ${ids.length} 张卡片。` : '已创建卡组。' });
          }
        }}>
        {!dialog.id && Boolean(dialog.cardIds?.length) && <p>创建后移入所选的 {dialog.cardIds?.length} 张卡片。</p>}
        <label className="growth-field">卡组名称<input autoFocus maxLength={60} value={selection} onChange={(event) => setSelection(event.target.value)} /></label>
        <label className="growth-field">卡组说明（可选）
          <textarea rows={3} maxLength={600} value={dialog.description ?? ''}
            onChange={(event) => setDialog({ ...dialog, description: event.target.value })} />
        </label>
        {dialog.id && <button type="button" className="knowledge-text-button danger" onClick={() => {
          setDialog({ kind: 'delete-group', id: dialog.id });
        }}>删除卡组</button>}
      </WorkspaceDialog>}
      {active && dialog?.kind === 'delete-group' && dialogGroup && <WorkspaceDialog title="删除卡组" action="确认删除" destructive
        onClose={() => setDialog(undefined)} onSave={() => {
          removeGroup(dialogGroup.id);
          if (folderGroup?.id === dialogGroup.id) returnInGrowth(boardHref);
          setFeedback({ text: '已删除卡组，组内卡片已回到看板。' });
        }}>
        <p>删除「{dialogGroup.name}」后，组内卡片会保留在各自的看板中。</p>
      </WorkspaceDialog>}
      {active && dialog?.kind === 'remove-exercise' && dialogExercises.length > 0 && <WorkspaceDialog title={REMOVE_EXERCISE_LABEL} action="确认移出" destructive
        valid={dialogExercises.length === dialog.cardIds?.length}
        onClose={() => setDialog(undefined)} onSave={() => {
          removeExercises(dialogExercises.map(({ id }) => id));
          setSelectedCards([]);
          setFeedback({ text: dialogExercises.length > 1 ? `已将 ${dialogExercises.length} 张卡片${REMOVE_EXERCISE_LABEL}。` : `已${REMOVE_EXERCISE_LABEL}。` });
        }}>
        <p>{dialogExercises.length === 1 ? `将「${dialogExercises[0].title}」${REMOVE_EXERCISE_LABEL}？` : `将所选的 ${dialogExercises.length} 张卡片${REMOVE_EXERCISE_LABEL}？`}</p>
      </WorkspaceDialog>}
      {active && dialog?.kind === 'move' && <WorkspaceDialog title="移到卡组" action="确认移动"
        valid={dialog.cardIds?.some((id) => (cardOwners.get(id) ?? '') !== selection)} onClose={() => setDialog(undefined)} onSave={() => {
        const ids = dialog.cardIds ?? [];
        if (!ids.every((id) => stackMembers.has(id))) throw new Error('有卡片已离开当前视图，请重新选择。');
        moveCards(ids, selection || null);
        setSelectedCards([]);
        setFeedback({ text: ids.length > 1 ? (selection ? `已将 ${ids.length} 张卡片移到所选卡组。` : `已将 ${ids.length} 张卡片移出卡组。`)
          : selection ? '已移到所选卡组。' : '已移出卡组。' });
      }}>
        {(dialog.cardIds?.length ?? 0) > 1 && <p>移动所选的 {dialog.cardIds?.length} 张卡片。</p>}
        <label className="growth-field">目标卡组
          <select autoFocus value={`group:${selection}`} onChange={(event) => {
            const destination = event.target.value;
            if (destination === 'create') {
              setSelection('');
              setDialog({ kind: 'group', cardIds: dialog.cardIds });
            } else setSelection(destination.slice('group:'.length));
          }}>
            <option value="group:">未分组</option>
            {groups.map((item) => <option key={item.id} value={`group:${item.id}`}>{item.name}</option>)}
            <option value="create">新建卡组…</option>
          </select>
        </label>
      </WorkspaceDialog>}
      {active && dialog && (dialog.kind === 'edit' || dialog.kind === 'delete') && dialogOutcome &&
        <WorkspaceDialog title={dialog.kind === 'edit' ? '选择要编辑的实践' : '删除实践'} action={dialog.kind === 'edit' ? '继续编辑' : '确认删除'}
          destructive={dialog.kind === 'delete'}
          valid={Boolean(dialogPractice)} onClose={() => setDialog(undefined)} onSave={() => {
            if (!dialogPractice) return;
            if (dialog.kind === 'edit') {
              if (dialog.trigger) begin({ outcome: dialogOutcome,
                preset: GROWTH_PRESETS.some(({ id }) => id === dialogOutcome.id), practice: dialogPractice }, dialog.trigger);
              return;
            }
            removePractice(dialogOutcome.id, dialogPractice.id);
            if (outcomeId === dialogOutcome.id && dialogOutcome.practices.length === 1) returnInGrowth(returnHref);
            setNotice(null);
            setFeedback({ text: '已删除实践。' });
          }}>
          {dialog.practiceId || dialogOutcome.practices.length === 1 ? (
            <p>实践记录 · {dialogPractice?.date}{dialogPractice?.note.trim() && ` · ${dialogPractice.note.trim().slice(0, 55)}`}</p>
          ) : <label className="growth-field">实践记录
            <select autoFocus={dialog.kind === 'edit'} value={selection} onChange={(event) => setSelection(event.target.value)}>
              {dialogOutcome.practices.map((practice, index) => <option value={practice.id} key={practice.id}>
                {practice.date} · {practice.note.trim().slice(0, 55) || `实践 ${dialogOutcome.practices.length - index}`}
              </option>)}
            </select>
          </label>}
          {dialog.kind === 'delete' && dialogOutcome.practices.length === 1 &&
            <p>{returnsToTry ? `这是最后一次实践，删除后卡片将回到「${PRACTICE_IDEAS_LABEL}」。` : '这是最后一次实践，删除后卡片将从成长记录移除。'}</p>}
        </WorkspaceDialog>}

      <section className="module-card" aria-label="参考路径与任务" hidden={Boolean(draft || exerciseDraft) || activeView !== 'topics'}>
        <SkillTree />
      </section>
    </div>
  );
}
