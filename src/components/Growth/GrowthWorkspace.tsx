import { useContext, useEffect, useEffectEvent, useRef, useState } from 'react';
import type { DragEvent, MouseEvent } from 'react';
import { GROWTH_DOMAINS, GROWTH_PRESETS } from '../../data/growthPresets';
import { useGrowthStore } from '../../store/growthStore';
import { GROWTH_DRAG_TYPE, useGrowthDragStore } from '../../store/growthDragStore';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import { exerciseHref, growthBoardHref, GROWTH_VIEWS, practiceHref, useWorkspaceStore, workspaceResourceTarget } from '../../store/workspaceStore';
import type { GrowthDomain, GrowthGroup, GrowthOutcome, GrowthPractice, SavedExercise } from '../../types';
import { CHAT_GROUP_CARD_LIMIT, CHAT_GROUP_DESCRIPTION_LIMIT } from '../../types/assistantChat';
import { growthExercises, logLabel } from '../../utils/growth';
import { codeVersionHref, codeVersionLabel, practiceCodeIds } from '../../utils/projectCode';
import { generateId } from '../../utils/storage';
import SkillTree from '../SkillTree/SkillTree';
import GrowthPracticeForm from './GrowthPracticeForm';
import GrowthExerciseForm from './GrowthExerciseForm';
import type { GrowthExerciseDraft } from './GrowthExerciseForm';
import GrowthCard from './GrowthCard';
import WorkspaceDialog from '../common/WorkspaceDialog';
import GrowthGroupStack from './GrowthGroupStack';
import GrowthFolder from './GrowthFolder';
import GrowthContextMenu from './GrowthContextMenu';
import type { GrowthMenu } from './GrowthContextMenu';
import type { GrowthCardAction } from './GrowthCard';
import type { GrowthDraft } from './GrowthPracticeForm';
import { AssistantSlots } from '../Assistant/assistantSlots';
import type { AssistantGrowthSelection } from '../Assistant/assistantSlots';

type SourceIds = Pick<GrowthPractice, 'logIds' | 'entryIds' | 'codeVersionIds'>;
type BoardDragEvent = Pick<DragEvent | globalThis.DragEvent, 'dataTransfer' | 'preventDefault' | 'stopPropagation'>;
type BoardMenuEvent = Pick<globalThis.MouseEvent, 'target' | 'shiftKey' | 'clientX' | 'clientY' | 'preventDefault'>;
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
  const { outcomes, exercises, hiddenPresetIds, groups, isLoaded, error, loadGrowth, removePractice, removeExercise, restorePreset,
    saveExercise, saveGroup, removeGroup, moveCard, previousArrangement, undoArrangement } = useGrowthStore();
  const [domain, setDomain] = useState<GrowthDomain | ''>('');
  const activeView = useWorkspaceStore((state) => state.growthView);
  const { openGrowthRecommendations, askAboutGrowth, close: closeAssistant } = useContext(AssistantSlots);
  const [notice, setNotice] = useState<{ text: string; saved: { outcomeId: string; id: string } } | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean }>();
  const [dialog, setDialog] = useState<{ kind: 'group' | 'move' | 'edit' | 'delete' | 'restore' | 'delete-group' | 'remove-exercise';
    id?: string; trigger?: HTMLButtonElement; practiceId?: string; cardIds?: string[]; exercise?: SavedExercise }>();
  const [folder, setFolder] = useState<{ id: string; origin: DOMRect }>();
  const [menu, setMenu] = useState<GrowthMenu>();
  const board = useRef<HTMLElement>(null);
  const addMenu = useRef<HTMLDivElement>(null);
  const addTrigger = useRef<HTMLButtonElement>(null);
  const exerciseTrigger = useRef<HTMLElement>(null);
  const [selection, setSelection] = useState('');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const groupId = useWorkspaceStore((state) => state.growthGroupId);
  const cardId = useWorkspaceStore((state) => state.growthCardId);
  const exerciseId = useWorkspaceStore((state) => state.growthExerciseId);
  const group = groups.find(({ id }) => id === groupId);
  const practiceTarget = useWorkspaceStore((state) => state.practiceTarget);
  const outcomeId = useWorkspaceStore((state) => state.growthOutcomeId);
  const focusedPractice = useRef<HTMLLIElement>(null);
  const focusedOutcome = useRef<HTMLHeadingElement>(null);
  const editorTrigger = useRef<HTMLButtonElement>(null);
  const selectedDomain = outcomeId || cardId || exerciseId ? '' : domain;

  useEffect(() => { loadGrowth(); }, [loadGrowth]);
  useEffect(() => {
    const close = () => { setFolder(undefined); setMenu(undefined); setSelectedCards([]); };
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
  const visibleOutcomes = sortedOutcomes.filter((outcome) => !selectedDomain || outcome.domains.includes(selectedDomain));
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
  const boardHref = growthBoardHref(boardView, group?.id);
  const cardInGroup = (id: string) => !group || group.cardIds.includes(id);
  const allPending = growthExercises({ exercises, hiddenPresetIds }).filter(({ id }) => !completedIds.has(id));
  const cardOwners = new Map(groups.flatMap((item) => item.cardIds.map((id) => [id, item.id] as const)));
  const showStacks = !group && !outcomeId && !exerciseId && !cardId;
  const showCard = (id: string) => cardInGroup(id) && (Boolean(group) || id === cardId || !cardOwners.has(id));
  const completedCards = visibleOutcomes.filter(({ id }) => showCard(id));
  const pendingCards = allPending
    .filter(({ id, domains }) => showCard(id) && (!selectedDomain || domains.includes(selectedDomain)));
  const activeExerciseDetails = pendingCards.find(({ id }) => id === exerciseId);
  const stackMembers = new Map([...allPending, ...outcomes].map((card) => [card.id, {
    id: card.id, title: card.title, domains: card.domains, complete: 'practices' in card,
    description: 'practices' in card ? outcomeDescription(card) ?? ''
      : [card.action, card.done].filter(Boolean).join('\n'),
  }]));
  const openFolder = groups.find(({ id }) => id === folder?.id);
  const visibleSelectionCards = openFolder ? openFolder.cardIds.filter((id) => stackMembers.has(id)) : [
    ...(activeView !== 'try' && !activeOutcome ? completedCards.map(({ id }) => id) : []),
    ...(activeView !== 'recent' && !activeExerciseDetails ? pendingCards.map(({ id }) => id) : []),
  ];
  const selectionIds = selectedCards.filter((id) => visibleSelectionCards.includes(id));
  const stacks = showStacks ? groups.flatMap((item) => {
    const members = item.cardIds.flatMap((id) => stackMembers.get(id) ?? []).filter(({ complete, domains }) =>
      complete === (activeView === 'recent') && (!selectedDomain || domains.includes(selectedDomain)));
    return members.length ? [{ group: item, members }] : [];
  }) : [];
  const selectableGroups = showStacks ? groups.filter((item) =>
    !item.cardIds.some((id) => stackMembers.has(id)) || stacks.some(({ group }) => group.id === item.id)) : groups;

  const editExercise = (trigger: HTMLElement, exercise?: SavedExercise) => {
    setFolder(undefined);
    exerciseTrigger.current = trigger;
    setExerciseDraft({ creating: !exercise, groupId: exercise ? undefined : group?.id, exercise: exercise ?? {
      id: generateId(), title: '', domains: domain ? [domain] : [], action: '', done: '',
      sources: { logIds: [], entryIds: [], codeVersionIds: [] },
    } });
  };
  const recordExercise = (exercise: SavedExercise, trigger: HTMLButtonElement) => {
    begin({ outcome: { id: exercise.id, title: exercise.title, domains: exercise.domains, description: exercise.action },
      preset: GROWTH_PRESETS.some(({ id }) => id === exercise.id), suggestedSources: exercise.sources }, trigger);
  };

  const begin = (next: GrowthDraft, trigger?: HTMLButtonElement) => {
    editorTrigger.current = trigger ?? null;
    setFolder(undefined);
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
      const ownerId = cardOwners.get(outcomeId) ?? group?.id;
      const href = practiceHref(outcomeId, savedId) + (ownerId ? '?' + new URLSearchParams({ group: ownerId }) : '');
      if (window.location.hash !== href) window.location.assign(href);
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
  const moveAction = (id: string): GrowthCardAction => ({ label: '移到卡组', run: canOpenForm ? (trigger) => {
    setFolder(undefined);
    setSelection(groups.find(({ cardIds }) => cardIds.includes(id))?.id ?? '');
    setDialog({ kind: 'move', id, trigger });
  } : undefined });
  const dialogOutcome = sortedOutcomes.find(({ id }) => id === dialog?.id);
  const dialogPractice = dialogOutcome?.practices.find(({ id }) => id === selection);
  const returnsToTry = dialogOutcome && (exercisesById.has(dialogOutcome.id) || GROWTH_PRESETS.some(({ id }) => id === dialogOutcome.id));
  const reportError = (error: unknown) => setFeedback({ text: error instanceof Error ? error.message : '操作失败，请重试。', error: true });
  const groupEditor = (itemId = group?.id) => {
    setFolder(undefined);
    setSelection(groups.find(({ id }) => id === itemId)?.name ?? '');
    setDialog({ kind: 'group', id: itemId });
  };
  const newOutcome = (trigger?: HTMLButtonElement) => begin({
    outcome: { id: generateId(), title: '', domains: selectedDomain ? [selectedDomain] : [] }, preset: false, groupId: group?.id,
  }, trigger);
  const dialogGroup = groups.find(({ id }) => id === dialog?.id);
  const dialogExercise = allPending.find(({ id }) => id === dialog?.id);
  const removeFromGroup = (id: string) => {
    try {
      moveCard(id, null);
      setFeedback({ text: '已移出卡组。' });
    } catch (error) { reportError(error); }
  };
  const groupActions = (id: string, ownerId?: string): GrowthCardAction[] => [moveAction(id), ...(ownerId ? [{
    label: '移出当前卡组', run: canOpenForm ? () => removeFromGroup(id) : undefined,
  }] : [])];
  const acceptDrop = (event: BoardDragEvent, targetGroup?: string, targetCard?: string) => {
    if (!event.dataTransfer?.types.includes(GROWTH_DRAG_TYPE)) return;
    event.stopPropagation();
    if (!canOpenForm) return;
    const transfer = useGrowthDragStore.getState().drag;
    if (!transfer) return;
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
          setFeedback({ text: targetGroup ? '已收藏并加入卡组的「待尝试」。' : '已加入待尝试。' });
        }
      } else if (targetGroup) {
        moveCard(transfer.cardId, targetGroup);
        setFeedback({ text: '已移到所选卡组。' });
      } else if (targetCard) {
        setSelection('');
        setDialog({ kind: 'group', cardIds: [targetCard, transfer.cardId] });
      }
    } catch (error) { reportError(error); }
  };
  const cardDrop = (id: string) => ({
    drag: canOpenForm ? { cardId: id } : undefined,
    onDragOver: (event: DragEvent<HTMLElement>) => { acceptDrop(event, cardOwners.get(id), id); },
    onDrop: (event: DragEvent<HTMLElement>) => dropOn(event, cardOwners.get(id), id),
  });
  const folderDragOutside = (event: BoardDragEvent, groupId: string) => {
    const transfer = useGrowthDragStore.getState().drag;
    if (!canOpenForm || !event.dataTransfer?.types.includes(GROWTH_DRAG_TYPE) || !transfer || !('cardId' in transfer)
      || cardOwners.get(transfer.cardId) !== groupId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    return transfer.cardId;
  };
  const undo = () => {
    try {
      undoArrangement();
      if (group && !useGrowthStore.getState().groups.some(({ id }) => id === group.id)) window.location.assign(growthBoardHref(boardView));
      setFeedback({ text: '已撤销上次卡片整理。' });
    } catch (error) { reportError(error); }
  };
  const openGroup = (id: string, trigger: HTMLElement) => {
    setSelectedCards([]);
    setFolder({ id, origin: trigger.getBoundingClientRect() });
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
    ? { id: JSON.stringify([...selectionIds].sort()), kind: 'selection', selection: cardSummaries(selectionIds) } : undefined;
  const dismissFolderForAsk = () => {
    if (!folder) return;
    setFolder(undefined);
    setSelectedCards([]);
  };
  const selectionProps = (id: string) => ({
    selected: selectionIds.includes(id),
    selectionContext: selectionIds.includes(id) ? selectionContext : undefined,
    onSelect: (extend: boolean) => setSelectedCards(!extend ? [id] : selectionIds.includes(id)
      ? selectionIds.filter((selected) => selected !== id) : [...selectionIds, id]),
  });
  const selectionBar = selectionIds.length > 0 && <div className="growth-selection" role="group" aria-label="所选卡片">
    <small role="status">已选 {selectionIds.length} 张{selectionIds.length > CHAT_GROUP_CARD_LIMIT && ` · 每次最多询问 ${CHAT_GROUP_CARD_LIMIT} 张`}</small>
    {selectionIds.length > 1 && <button type="button" className="growth-board-group-button" disabled={!selectionContext}
      onClick={() => {
        if (!selectionContext) return;
        dismissFolderForAsk();
        askAboutGrowth(selectionContext);
      }}>询问智能体</button>}
    <button type="button" className="knowledge-text-button" onClick={() => setSelectedCards([])}>取消选择</button>
  </div>;
  const showGroupMenu = (event: MouseEvent<HTMLAnchorElement>, item: GrowthGroup) => {
    if (event.shiftKey && event.button === 2) return;
    event.preventDefault();
    event.stopPropagation();
    const trigger = event.currentTarget;
    const box = trigger.getBoundingClientRect();
    setMenu({ x: event.clientX || box.left, y: event.clientY || box.bottom, title: '卡组操作', trigger, keyboard: event.button !== 2,
      actions: [
        { label: '打开卡组', run: () => openGroup(item.id, trigger) },
        { label: '询问智能体', run: () => askAboutGroup(item) },
        { label: '重命名卡组', run: () => groupEditor(item.id) },
        { label: '删除卡组', danger: true, run: () => setDialog({ kind: 'delete-group', id: item.id }) },
      ] });
  };
  const onBoardMenu = (event: BoardMenuEvent, trigger: HTMLElement) => {
    if (!canOpenForm || !(event.target instanceof Element) || event.target.closest('article, a, button, select, .growth-board-toolbar') || event.shiftKey) return;
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, title: '成长记录操作', actions: [
      activeView === 'try' ? { label: '添加待尝试', run: () => editExercise(addTrigger.current ?? trigger) }
        : { label: '记录自定义成果', run: () => newOutcome() },
      { label: '让智能体推荐', run: () => openGrowthRecommendations(domain || undefined) },
      { label: '新建卡组', run: () => { setSelection(''); setDialog({ kind: 'group' }); } },
      ...(previousArrangement ? [{ label: '撤销整理', run: undo }] : []),
    ] });
  };
  const onPageBackground = useEffectEvent((event: globalThis.MouseEvent) => {
    const surface = board.current;
    if (!surface || surface.hidden || !(event.target instanceof Element) ||
      !event.target.matches('.app-shell, .app-content, main, #path, .growth-workspace')) return;
    if (event.type === 'contextmenu') onBoardMenu(event, surface);
    else if (event instanceof globalThis.DragEvent) {
      if (event.type === 'drop') dropOn(event, group?.id);
      else acceptDrop(event, group?.id);
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
  const stackTiles = stacks.map(({ group: item, members }) => <GrowthGroupStack key={item.id} group={item} cards={members}
    onDragOver={(event) => { acceptDrop(event, item.id); }} onDrop={(event) => dropOn(event, item.id)}
    onOpen={(event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openGroup(item.id, event.currentTarget);
    }}
    onContextMenu={(event) => showGroupMenu(event, item)} />);
  const renderOutcome = (outcome: GrowthOutcome, ownerId = group?.id) => {
    const latest = outcome.practices[0];
    const preset = GROWTH_PRESETS.find((item) => item.id === outcome.id);
    const description = outcomeDescription(outcome);
    const note = latest.note.trim();
    const href = `#path/${encodeURIComponent(outcome.id)}` + (ownerId ? '?' + new URLSearchParams({ group: ownerId }) : '');
    return <GrowthCard key={outcome.id} id={outcome.id} href={href} highlighted={active && cardId === outcome.id} {...cardDrop(outcome.id)} {...selectionProps(outcome.id)}
      onAsk={dismissFolderForAsk}
      card={{ title: outcome.title, domains: outcome.domains, description: [description, note].filter(Boolean).join('\n') }}
      actions={[
        { label: '编辑实践', run: canOpenForm ? (trigger) => choosePractice('edit', outcome, trigger) : undefined },
        { label: '删除实践', run: canOpenForm ? (trigger) => choosePractice('delete', outcome, trigger) : undefined },
        ...groupActions(outcome.id, ownerId),
      ]}
      recordLabel="追加实践" onRecord={canOpenForm ? (trigger) => begin({ outcome, preset: Boolean(preset) }, trigger) : undefined}>
      {description && <p className="growth-card-summary">{description}</p>}
      {note && <p className="growth-card-summary">{note}</p>}
      <small className="growth-muted">{outcome.practices.length} 次实践 · <time dateTime={latest.date}>{latest.date}</time></small>
    </GrowthCard>;
  };
  const renderExercise = (exercise: SavedExercise, ownerId = group?.id) => {
    const { id, title, domains, action, done } = exercise;
    return <GrowthCard key={id} id={id} href={exerciseHref(id, ownerId)} highlighted={active && cardId === id} {...cardDrop(id)} {...selectionProps(id)}
      onAsk={dismissFolderForAsk}
      card={{ title, domains, description: done ? `${action}\n完成条件：${done}` : action }} recordLabel="我做到了"
      actions={[{ label: '编辑卡片', run: canOpenForm ? (trigger) => editExercise(trigger, exercise) : undefined },
        ...groupActions(id, ownerId), { label: '移出待尝试', run: canOpenForm ? () => setDialog({ kind: 'remove-exercise', id }) : undefined }]}
      onRecord={canOpenForm ? (trigger) => recordExercise(exercise, trigger) : undefined}>
      <p className="growth-card-summary">{action || done}</p>
    </GrowthCard>;
  };

  return (
    <div className="growth-workspace">
      {exerciseDraft && <section className="module-card growth-editor" aria-label="卡片编辑">
        <GrowthExerciseForm {...exerciseDraft} onCancel={() => {
          setExerciseDraft(undefined);
          window.requestAnimationFrame(() => exerciseTrigger.current?.focus());
        }} onSaved={() => {
          setExerciseDraft(undefined);
          const href = exerciseHref(exerciseDraft.exercise.id, cardOwners.get(exerciseDraft.exercise.id) ?? group?.id);
          if (window.location.hash !== href) window.location.assign(href);
          else window.requestAnimationFrame(() => focusedOutcome.current?.focus());
        }} />
      </section>}
      {draft && (
        <section className="module-card growth-editor" aria-label="实践编辑">
          <GrowthPracticeForm draft={draft} onClose={closeEditor} />
        </section>
      )}
      <section ref={board} className="growth-board" aria-label={group && activeView === 'all' ? group.name : activeView === 'try' ? '待尝试' : '已完成'}
        hidden={Boolean(draft || exerciseDraft) || activeView === 'topics'}
        onClick={(event) => { if (event.target instanceof Element && !event.target.closest('article, a, button, .growth-board-toolbar, .growth-selection')) setSelectedCards([]); }}
        onContextMenu={(event) => onBoardMenu(event, event.currentTarget)}
        onDragOver={(event) => { if (!(event.target instanceof Element && event.target.closest('.growth-board-toolbar, article, a'))) acceptDrop(event, group?.id); }}
        onDrop={(event) => { if (!(event.target instanceof Element && event.target.closest('.growth-board-toolbar, article, a'))) dropOn(event, group?.id); }}>
        <div className="growth-board-toolbar">
          <nav className="workspace-segments" aria-label="实践状态">
            {group && <a href={growthBoardHref('all', group.id)} aria-current={activeView === 'all' ? 'page' : undefined}>全部</a>}
            {GROWTH_VIEWS.map((view) => <a key={view.id} href={growthBoardHref(view.id, group?.id)} aria-current={activeView === view.id ? 'page' : undefined}>{view.label}</a>)}
          </nav>
          <label className="growth-filter">卡组
            <select aria-label="卡组" value={group?.id ?? ''} onChange={(event) => {
              const id = event.target.value;
              if (id && !group && !outcomeId && !exerciseId && !cardId) openGroup(id, event.currentTarget);
              else window.location.hash = growthBoardHref(id ? 'all' : boardView, id);
            }}>
              <option value="">所有卡片</option>
              {selectableGroups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <button type="button" className="growth-board-group-button" onClick={() => groupEditor()} disabled={!canOpenForm}>
            {group ? '管理卡组' : '新建卡组'}
          </button>
          <label className="growth-filter">按领域筛选
            <select value={selectedDomain} onChange={(event) => {
              setSelectedCards([]);
              setDomain(event.target.value as GrowthDomain | '');
              if (outcomeId || cardId || exerciseId) window.location.hash = boardHref;
            }}>
              <option value="">全部领域</option>
              {GROWTH_DOMAINS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          {activeView !== 'try' ? (
            <button type="button" className="note-button growth-board-primary" disabled={!canOpenForm}
              onClick={(event) => newOutcome(event.currentTarget)}>记录自定义成果</button>
          ) : (
            <div className="growth-board-primary">
              <button ref={addTrigger} type="button" className="note-button" popoverTarget="growth-add-exercise" disabled={!canOpenForm}>添加待尝试</button>
              <div ref={addMenu} id="growth-add-exercise" popover="auto" className="workspace-context-menu growth-add-exercise" onToggle={(event) => {
                const menu = event.currentTarget;
                const box = addTrigger.current?.getBoundingClientRect();
                if (!box || !menu.matches(':popover-open')) return;
                menu.style.left = `${Math.max(8, box.right - menu.offsetWidth)}px`;
                menu.style.top = `${Math.min(box.bottom + 6, window.innerHeight - menu.offsetHeight - 8)}px`;
              }}>
                <button type="button" onClick={() => {
                  addMenu.current?.hidePopover();
                  if (addTrigger.current) editExercise(addTrigger.current);
                }}>自己填写</button>
                <button type="button" onClick={() => {
                  addMenu.current?.hidePopover();
                  openGrowthRecommendations(domain || undefined);
                }}>让智能体推荐</button>
              </div>
            </div>
          )}
          {activeView === 'try' && hiddenPresetIds.length > 0 && <button type="button" className="growth-board-group-button" disabled={!canOpenForm}
            onClick={() => { setSelection(hiddenPresetIds[0]); setDialog({ kind: 'restore' }); }}>恢复内置练习</button>}
          {previousArrangement && <button type="button" className="growth-board-group-button" onClick={undo}>撤销整理</button>}
        </div>
        {!folder && selectionBar}
        {error && <p role="alert">{error}</p>}
        {feedback && <p className="growth-muted" role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
        {activeView !== 'try' && (
          <div>
            {activeView === 'all' && completedCards.length > 0 && <h2 className="growth-group-status">已完成</h2>}
            {activeView === 'recent' && isLoaded && !error && completedCards.length === 0 && stacks.length === 0 && (
              <p className="growth-muted">{selectedDomain || group ? '当前筛选下没有已完成的卡片。' : '还没有成果记录。可以从「待尝试」选一项练习，或记录自己的成果。'}</p>
            )}
            {activeOutcome ? (
              <article className="growth-card growth-outcome growth-detail" aria-label={activeOutcome.title}>
                <a className="growth-back-link" href={group ? growthBoardHref('all', group.id) : boardHref}>← 返回卡片</a>
                <h2 ref={focusedOutcome} tabIndex={-1}>{activeOutcome.title}</h2>
                <small className="growth-muted">{activeOutcome.practices.length} 次实践</small>
                {activeDescription && <p className="growth-note">{activeDescription}</p>}
                {activeExercise?.done && <p className="growth-note"><strong>完成条件</strong> {activeExercise.done}</p>}
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
            ) : <div className="growth-card-grid">
              {activeView === 'recent' && stackTiles}
              {completedCards.map((item) => renderOutcome(item))}
            </div>}
          </div>
        )}
        {activeView !== 'recent' && (
          <div>
            {activeView === 'all' && pendingCards.length > 0 && <h2 className="growth-group-status">待尝试</h2>}
            {pendingCards.length === 0 && stacks.length === 0 && (activeView === 'try' || completedCards.length === 0) &&
              <p className="growth-muted">{activeView === 'all' ? '当前卡组没有符合筛选条件的卡片。' : '当前筛选下没有待尝试的卡片。'}</p>}
            {activeExerciseDetails ? <article className="growth-card growth-outcome growth-detail" aria-label={activeExerciseDetails.title}>
              <a className="growth-back-link" href={boardHref}>← 返回卡片</a>
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
              {activeExerciseDetails.done && <p className="growth-note"><strong>完成条件</strong> {activeExerciseDetails.done}</p>}
              <PracticeSources practice={activeExerciseDetails.sources} />
            </article> : <div className="growth-card-grid growth-pending-grid">
              {activeView === 'try' && stackTiles}
              {pendingCards.map((item) => renderExercise(item))}
            </div>}
          </div>
        )}
      </section>
      {active && menu && <GrowthContextMenu menu={menu} onClose={() => setMenu(undefined)} />}
      {active && openFolder && folder && <GrowthFolder name={openFolder.name} origin={folder.origin}
        onClose={() => { setFolder(undefined); setSelectedCards([]); }} onManage={() => groupEditor(openFolder.id)}
        onDragOutside={(event) => Boolean(folderDragOutside(event, openFolder.id))}
        onDropOutside={(event) => {
          const id = folderDragOutside(event, openFolder.id);
          if (!id) return;
          useGrowthDragStore.setState({ drag: undefined });
          removeFromGroup(id);
        }}>
        {selectionBar}
        {feedback && <p className="growth-muted" role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
        {openFolder.cardIds.some((id) => completedIds.has(id)) && <>
          <h3>已完成</h3>
          <div className="growth-card-grid">{sortedOutcomes.filter(({ id }) => openFolder.cardIds.includes(id))
            .map((item) => renderOutcome(item, openFolder.id))}</div>
        </>}
        {allPending.some(({ id }) => openFolder.cardIds.includes(id)) && <>
          <h3>待尝试</h3>
          <div className="growth-card-grid growth-pending-grid">{allPending.filter(({ id }) => openFolder.cardIds.includes(id))
            .map((item) => renderExercise(item, openFolder.id))}</div>
        </>}
        {!openFolder.cardIds.some((id) => stackMembers.has(id)) && <p className="growth-muted">这个卡组暂无可显示的卡片。</p>}
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
      {active && dialog?.kind === 'group' && <WorkspaceDialog title={dialog.id ? '管理卡组' : '新建卡组'} action={dialog.id ? '保存名称' : '创建卡组'}
        valid={Boolean(selection.trim())} onClose={() => setDialog(undefined)} onSave={() => {
          const id = saveGroup(selection, dialog.id, dialog.cardIds, dialog.exercise);
          if (!dialog.id) setFeedback({ text: '已创建卡组。' });
          else if (group?.id === id) window.location.assign(growthBoardHref('all', id));
        }}>
        <label className="growth-field">卡组名称<input autoFocus maxLength={60} value={selection} onChange={(event) => setSelection(event.target.value)} /></label>
        {dialog.id && <button type="button" className="knowledge-text-button danger" onClick={() => {
          setDialog({ kind: 'delete-group', id: dialog.id });
        }}>删除卡组</button>}
      </WorkspaceDialog>}
      {active && dialog?.kind === 'delete-group' && dialogGroup && <WorkspaceDialog title="删除卡组" action="确认删除" destructive
        onClose={() => setDialog(undefined)} onSave={() => {
          removeGroup(dialogGroup.id);
          if (group?.id === dialogGroup.id) window.location.assign(growthBoardHref(boardView));
          setFeedback({ text: '已删除卡组，组内卡片已回到所有卡片。' });
        }}>
        <p>删除「{dialogGroup.name}」后，组内卡片会保留在「所有卡片」中。</p>
      </WorkspaceDialog>}
      {active && dialog?.kind === 'remove-exercise' && dialogExercise && <WorkspaceDialog title="移出待尝试" action="确认移出" destructive
        onClose={() => setDialog(undefined)} onSave={() => {
          removeExercise(dialogExercise.id);
          setFeedback({ text: '已移出待尝试。' });
        }}>
        <p>将「{dialogExercise.title}」移出「待尝试」？</p>
      </WorkspaceDialog>}
      {active && dialog?.kind === 'move' && <WorkspaceDialog title="移到卡组" action="确认移动" onClose={() => setDialog(undefined)} onSave={() => {
        if (!dialog.id) return;
        moveCard(dialog.id, selection || null);
        setFeedback({ text: selection ? '已移到所选卡组。' : '已移出卡组。' });
      }}>
        <label className="growth-field">目标卡组
          <select autoFocus value={selection} onChange={(event) => setSelection(event.target.value)}>
            <option value="">未分组</option>
            {groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
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
            if (outcomeId === dialogOutcome.id && dialogOutcome.practices.length === 1) window.location.assign(boardHref);
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
            <p>{returnsToTry ? '这是最后一次实践，删除后卡片将回到「待尝试」。' : '这是最后一次实践，删除后卡片将从成长记录移除。'}</p>}
        </WorkspaceDialog>}

      <section className="module-card" aria-label="参考路径与任务" hidden={Boolean(draft || exerciseDraft) || activeView !== 'topics'}>
        <h2>参考路径</h2>
        <SkillTree />
      </section>
    </div>
  );
}
