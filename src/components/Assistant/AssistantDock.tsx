import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import type { GrowthDomain, SavedExercise, StudyLog } from '../../types';
import { useGrowthStore } from '../../store/growthStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { isOpenSelect } from '../../utils/selectPicker';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import { STORAGE_PREFIX } from '../../utils/workspaceMode';
import AssistantChat from './AssistantChat';
import AssistantReviewPicker from './AssistantReviewPicker';
import AssistantSearch from './AssistantSearch';
import { useResourceSearchResults } from '../Search/useResourceSearchResults';
import AssistantCodePicker from './AssistantCodePicker';
import GrowthSuggestions from './GrowthSuggestions';
import LogReviewPanel from '../StudyLog/LogReviewPanel';
import type { AssistantStart } from './AssistantGuide';
import type { AssistantAction } from './assistantActions';
import { reviewDateFilter } from './assistantActions';
import type { SearchScope } from '../../utils/resourceSearch';
import { AssistantSlots } from './assistantSlots';
import type { AssistantCodeReference, AssistantGrowthReference, AssistantLogDraft, AssistantLogKind, ReviewConversation, ReviewReference } from './assistantSlots';
import { assistantViewport, boundFrame, boundPosition, defaultFrame, resizeFrame, windowGap } from './assistantGeometry';
import type { Frame, Point } from './assistantGeometry';

const positionKey = STORAGE_PREFIX + 'assistant-position';
const frameKey = STORAGE_PREFIX + 'assistant-window';
type DragKind = 'launcher' | 'move' | 'resize';
interface Gesture { kind: DragKind; pointer: number; start: Point; origin: Frame; moved: boolean }
interface Menu extends Point { trigger: HTMLElement; launcher: boolean }
type AssistantMode = 'chat' | 'review' | 'search' | 'recommend';

export default function AssistantDock({ activePage, activeLog, onStart, onRecordRecommendation, editingGrowth, children }: {
  activePage: string;
  activeLog?: { kind: AssistantLogKind; log: StudyLog; editing: boolean };
  onStart: (page: AssistantStart) => void;
  onRecordRecommendation: (item: SavedExercise, groupId?: string) => void;
  editingGrowth: boolean;
  children: ReactNode;
}) {
  const [today, setToday] = useState<HTMLDivElement | null>(null);
  const [history, setHistory] = useState<HTMLDivElement | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<AssistantLogKind, AssistantLogDraft>>>({});
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [mode, setMode] = useState<AssistantMode>();
  const [choosingLog, setChoosingLog] = useState(false);
  const [dateQuery, setDateQuery] = useState('');
  const [reviewId, setReviewId] = useState<string>();
  const [recentReviews, setRecentReviews] = useState<string[]>([]);
  const [reviewStart, setReviewStart] = useState<{ focus: string }>();
  const [reviewReference, setReviewReference] = useState<ReviewReference>();
  const reviewPanels = useRef(new Map<string, ReviewConversation>());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const [recommendationDomain, setRecommendationDomain] = useState<GrowthDomain | ''>('');
  const [recommendationGroupId, setRecommendationGroupId] = useState<string>();
  const [recommendationFocus, setRecommendationFocus] = useState('');
  const [recommendationRecentLogs, setRecommendationRecentLogs] = useState(false);
  const [recommendationStart, setRecommendationStart] = useState(false);
  const logs = useStudyLogStore((state) => state.logs);
  const growthLoaded = useGrowthStore((state) => state.isLoaded);
  const growthError = useGrowthStore((state) => state.error);
  const recommendationGroup = useGrowthStore((state) => state.groups.find(({ id }) => id === recommendationGroupId));
  const activeGroupId = useWorkspaceStore((state) => state.growthGroupId);
  const [codeExcerpt, setCodeExcerpt] = useState<AssistantCodeReference>();
  const [growthReference, setGrowthReference] = useState<AssistantGrowthReference>();
  const [pickingCode, setPickingCode] = useState(false);
  const [viewport, setViewport] = useState(assistantViewport);
  const [position, setPosition] = useState<Point | null>(() => {
    const stored = getStorageItem<Point | null>(positionKey, null);
    return stored && Number.isFinite(stored.x) && Number.isFinite(stored.y) ? stored : null;
  });
  const [frame, setFrame] = useState<Frame | null>(() => {
    const stored = getStorageItem<Frame | null>(frameKey, null);
    return stored && [stored.x, stored.y, stored.width, stored.height].every(Number.isFinite) ? stored : null;
  });
  const [preview, setPreview] = useState<{ kind: DragKind; frame: Frame }>();
  const [menu, setMenu] = useState<Menu>();
  const drag = useRef<Gesture | null>(null);
  const ignoreClick = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuItems = useRef<HTMLDivElement>(null);

  const editingLog = activeLog?.editing ? activeLog : undefined;
  const tab = mode ?? (editingLog ? 'review' : 'chat');
  const searchResults = useResourceSearchResults({ query: searchQuery, scope: searchScope, includeSource: true,
    active: tab === 'search', individualPractices: true });
  const filterLabel = searchResults.words.length ? searchQuery.trim() : searchScope === 'path' ? '最近的实践' : undefined;
  const resourceQuestion = { results: searchResults, filterLabel };
  const reviewTargetId = reviewId ?? editingLog?.log.id;
  const reviewKind = (['today', 'history'] as const).find((kind) => reviewTargetId && drafts[kind]?.id === reviewTargetId);
  const savedReview = logs.find(({ id }) => id === reviewTargetId);
  const reviewTarget = (reviewKind && drafts[reviewKind]) || savedReview;
  const showPicker = !reviewTarget || choosingLog;
  const savedReviewForm = (id: string) => 'assistant-review-saved-' + encodeURIComponent(id);
  const reviewForm = reviewKind ? `assistant-review-${reviewKind}` : savedReview ? savedReviewForm(savedReview.id) : undefined;
  const reviewLogs = logs.filter(({ id }) => recentReviews.includes(id) || id === savedReview?.id);
  const draft = editingLog && drafts[editingLog.kind];
  const source = activeLog && {
    id: activeLog.log.id, date: activeLog.log.date,
    text: draft && draft.id === activeLog.log.id ? draft.text : activeLog.log.content,
    draft: activeLog.editing,
  };
  const windowFrame = preview && preview.kind !== 'launcher' ? preview.frame : frame ? boundFrame(frame, viewport) : defaultFrame(viewport);
  const shown = preview?.kind === 'launcher' ? preview.frame : position && boundPosition(position, 48, 48, viewport);
  const overGroup = Boolean(recommendationGroup && activePage === 'path' && activeGroupId === recommendationGroup.id && !editingGrowth);
  const modal = viewport.compact || overGroup;
  const setLogDraft = useCallback((kind: AssistantLogKind, value?: AssistantLogDraft) => {
    setDrafts((current) => ({ ...current, [kind]: value }));
  }, []);
  const close = useCallback(() => {
    setMenu(undefined);
    setOpen(false);
    setMinimized(false);
    dialog.current?.close();
    launcher.current?.focus({ preventScroll: true });
  }, []);
  const minimize = () => {
    close();
    setMinimized(true);
  };
  const openGrowthRecommendations = useCallback((domain?: GrowthDomain, groupId?: string) => {
    if (domain !== undefined) setRecommendationDomain(domain);
    setRecommendationGroupId(groupId);
    setRecommendationRecentLogs(false);
    setMode('recommend');
    setMenu(undefined);
    setMinimized(false);
    setOpen(true);
  }, []);
  const askAboutCode = useCallback((excerpt: AssistantCodeReference) => {
    setCodeExcerpt(excerpt);
    setGrowthReference(undefined);
    setPickingCode(false);
    setMode('chat');
    setMenu(undefined);
    setMinimized(false);
    setOpen(true);
  }, []);
  const askAboutGrowth = useCallback((reference: AssistantGrowthReference) => {
    setGrowthReference(reference);
    setCodeExcerpt(undefined);
    setPickingCode(false);
    setMode('chat');
    setMenu(undefined);
    setMinimized(false);
    setOpen(true);
  }, []);
  const registerReview = useCallback((id: string, view: ReviewConversation) => {
    reviewPanels.current.set(id, view);
    return () => { if (reviewPanels.current.get(id) === view) reviewPanels.current.delete(id); };
  }, []);
  const focusToolInput = useCallback(() => {
    const previousFocus = document.activeElement;
    window.requestAnimationFrame(() => {
      if (document.activeElement !== previousFocus && document.activeElement !== document.body) return;
      dialog.current?.querySelector<HTMLTextAreaElement>('#assistant-input')?.focus({ preventScroll: true });
    });
  }, []);
  const slots = useMemo(() => ({ today, history, close, registerReview, reviewReference, setReviewReference, focusAssistantInput: focusToolInput,
    setLogDraft, askAboutCode, openGrowthRecommendations, askAboutGrowth }),
  [today, history, close, registerReview, reviewReference, focusToolInput, setLogDraft, askAboutCode, openGrowthRecommendations, askAboutGrowth]);
  useEffect(() => {
    if (tab !== 'review' || showPicker || !reviewForm || !reviewStart) return;
    // Wait for the selected panel to finish mounting (including StrictMode's effect replay).
    const frame = requestAnimationFrame(() => {
      const panel = reviewPanels.current.get(reviewForm);
      if (!panel) return;
      setReviewStart(undefined);
      panel.generate(reviewStart.focus);
    });
    return () => cancelAnimationFrame(frame);
  }, [reviewStart, reviewForm, showPicker, tab, today, history]);
  useEffect(() => {
    if (tab !== 'recommend' || !recommendationStart) return;
    const frame = requestAnimationFrame(() => {
      setRecommendationStart(false);
      dialog.current?.querySelector<HTMLFormElement>('#assistant-recommend-form')?.requestSubmit();
    });
    return () => cancelAnimationFrame(frame);
  }, [recommendationStart, tab]);

  useEffect(() => {
    const resize = () => {
      drag.current = null;
      setPreview(undefined);
      setViewport(assistantViewport());
      setMenu(undefined);
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element || !open || (element.open && element.matches(':modal') === modal)) return;
    const previousFocus = document.activeElement;
    if (element.open) element.close();
    if (modal) element.showModal();
    else element.show();
    if (previousFocus instanceof HTMLElement && element.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
    else closeButton.current?.focus({ preventScroll: true });
  }, [open, modal]);

  const saveFrame = (next: Frame | null) => {
    setFrame(next);
    setStorageItem(frameKey, next);
  };
  const start = (event: PointerEvent<HTMLElement>, kind: DragKind) => {
    if (!event.isPrimary || event.button !== 0 || drag.current || (kind !== 'launcher' && viewport.compact)) return;
    if (kind === 'move' && event.target instanceof Element && event.target.closest('button')) return;
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    if (kind === 'launcher') ignoreClick.current = false;
    drag.current = {
      kind, pointer: event.pointerId, start: { x: event.clientX, y: event.clientY }, moved: false,
      origin: kind === 'launcher' ? { x: left, y: top, width, height } : windowFrame,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const calculate = ({ kind, origin, start }: Gesture, point: Point): Frame => {
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    if (kind === 'resize') return resizeFrame(origin, dx, dy, viewport);
    return { ...origin, ...boundPosition({ x: origin.x + dx, y: origin.y + dy }, origin.width, origin.height, viewport) };
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    if (!current.moved && Math.hypot(event.clientX - current.start.x, event.clientY - current.start.y) < 6) return;
    current.moved = true;
    if (current.kind === 'launcher') ignoreClick.current = true;
    setPreview({ kind: current.kind, frame: calculate(current, { x: event.clientX, y: event.clientY }) });
  };
  const finish = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    drag.current = null;
    setPreview(undefined);
    if (!current.moved || event.type !== 'pointerup') return;
    const next = calculate(current, { x: event.clientX, y: event.clientY });
    if (current.kind === 'launcher') {
      const point = { x: next.x, y: next.y };
      setPosition(point);
      setStorageItem(positionKey, point);
    } else saveFrame(next);
  };
  const dragHandlers = { onPointerMove: move, onPointerUp: finish, onPointerCancel: finish, onLostPointerCapture: finish };
  const launch = () => {
    if (open) { closeButton.current?.focus(); return; }
    if (!mode && editingLog) {
      setMode('review');
      setReviewId(editingLog.log.id);
    }
    setMinimized(false);
    setOpen(true);
  };
  const selectReviewLog = (id: string) => {
    setReviewId(id);
    setRecentReviews((current) => [...current.filter((item) => item !== id), id].slice(-4));
    setChoosingLog(false);
    focusToolInput();
  };
  const runAction = (action: AssistantAction) => {
    setReviewStart(undefined);
    if (action.kind === 'recommend') {
      openGrowthRecommendations(undefined, overGroup ? recommendationGroupId : undefined);
      if (action.focus) setRecommendationFocus(action.focus);
      setRecommendationRecentLogs(action.recentLogs === true);
      setRecommendationStart(Boolean(action.generate));
    } else if (action.kind === 'review') {
      setMode('review');
      if (action.generate) setReviewStart({ focus: action.focus ?? '' });
      const matchesDate = action.date ? reviewDateFilter(action.date) : undefined;
      const matches = matchesDate ? logs.filter(({ date }) => matchesDate(date)) : [];
      const target = action.date ? (matches.length === 1 ? matches[0].id : undefined)
        : activeLog?.log.id ?? reviewTargetId;
      setReviewId(target);
      if (target) setRecentReviews((recent) => [...recent.filter((id) => id !== target), target].slice(-4));
      setDateQuery(action.date);
      setChoosingLog(!target);
    } else if (action.kind === 'findEntry' || action.kind === 'findResources' || action.kind === 'findPractice') {
      setMode('search');
      setSearchQuery(action.query);
      setSearchScope(action.kind === 'findEntry' ? 'knowledge' : action.kind === 'findPractice' ? 'path' : 'all');
    } else {
      setMode('chat');
      setPickingCode(true);
    }
    focusToolInput();
  };
  const provideReviewDate = (message: string) => {
    if (tab !== 'review' || !showPicker) return;
    const date = message.replace(/^(?:是|就要|就选|那就|选)\s*/u, '').replace(/[。！!]$/u, '').trim();
    const match = reviewDateFilter(date);
    if (!match) return;
    const candidates = logs.filter((log) => match(log.date));
    if (candidates.length === 1) { selectReviewLog(candidates[0].id); return `已找到 ${candidates[0].date} 的学习日志。`; }
    setDateQuery(date);
    return candidates.length ? '找到多篇同月同日的日志。请再补充年份。' : '没有定位到这一天的日志，可以再告诉我日期。';
  };
  const showMenu = (trigger: HTMLElement, fromLauncher: boolean, point?: Point) => {
    const box = trigger.getBoundingClientRect();
    const origin = fromLauncher ? undefined : dialog.current?.getBoundingClientRect();
    setMenu({
      trigger, launcher: fromLauncher,
      x: Math.max(windowGap, Math.min((point?.x ?? box.left) - (origin?.left ?? 0), (origin?.width ?? viewport.width) - 190)),
      y: Math.max(windowGap, Math.min((point?.y ?? box.bottom) - (origin?.top ?? 0), (origin?.height ?? viewport.height) - 162)),
    });
  };
  useEffect(() => {
    if (!menu) return;
    menuItems.current?.querySelector('button')?.focus();
    const outside = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && !menuItems.current?.contains(event.target) && !menu.trigger.contains(event.target)) setMenu(undefined);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      setMenu(undefined);
      menu.trigger.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, [menu]);
  const menuAction = (action: () => void) => {
    setMenu(undefined);
    menu?.trigger.focus({ preventScroll: true });
    action();
  };
  const dock = (side: 'left' | 'right') => {
    saveFrame({ ...windowFrame, x: side === 'left' ? windowGap : viewport.width - windowFrame.width - windowGap });
    if (!open) launch();
  };
  const operations = menu && <div ref={menuItems} className="assistant-window-menu" role="group" aria-label="窗口操作"
    style={{ left: menu.x, top: menu.y }} data-global={menu.launcher || undefined}>
    {!viewport.compact && <>
      <button type="button" onClick={() => menuAction(() => dock('left'))}>靠左</button>
      <button type="button" onClick={() => menuAction(() => dock('right'))}>靠右</button>
      <button type="button" onClick={() => menuAction(() => saveFrame(null))}>恢复默认位置和大小</button>
    </>}
    {menu.launcher && <button type="button" onClick={() => menuAction(() => { setPosition(null); setStorageItem(positionKey, null); })}>重置图标位置</button>}
  </div>;

  return <AssistantSlots.Provider value={slots}>
    {children}
    <button ref={launcher} type="button" className="assistant-launcher"
      aria-label={minimized ? '恢复学习智能体' : '打开学习智能体'} title={minimized ? '恢复学习智能体' : '学习智能体 · 可拖动'}
      aria-haspopup="dialog" aria-expanded={open} aria-controls="assistant-drawer"
      data-dev={import.meta.env.DEV || undefined} data-dragging={preview?.kind === 'launcher' || undefined}
      style={shown ? { left: shown.x, top: shown.y, right: 'auto', bottom: 'auto' } : undefined}
      onPointerDown={(event) => start(event, 'launcher')} {...dragHandlers}
      onContextMenu={(event) => {
        event.preventDefault();
        showMenu(event.currentTarget, true, { x: event.clientX, y: event.clientY });
      }}
      onClick={(event) => {
        if (event.detail > 0 && ignoreClick.current) return;
        setMenu(undefined);
        launch();
      }}>
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 11a7 7 0 0 1-7 7H8l-4 3v-7a7 7 0 0 1 7-7h2a7 7 0 0 1 7 4Z" />
        <path d="m18 2 .8 2.2L21 5l-2.2.8L18 8l-.8-2.2L15 5l2.2-.8L18 2ZM8 12h6m-6 3h4" />
      </svg>
      {minimized && <span className="assistant-minimized-mark" aria-hidden="true">−</span>}
    </button>
    {menu?.launcher && operations}
    <dialog ref={dialog} id="assistant-drawer" className="assistant-drawer" aria-labelledby="assistant-heading"
      style={viewport.compact ? undefined : { left: windowFrame.x, top: windowFrame.y, width: windowFrame.width, height: windowFrame.height }}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        close();
      }}
      onKeyDown={(event) => {
        if (viewport.compact || event.key !== 'Escape' || event.nativeEvent.isComposing || event.defaultPrevented
          || !(event.target instanceof Element) || event.target.closest('dialog') !== event.currentTarget) return;
        if (isOpenSelect(event.target)) {
          event.stopPropagation();
          return;
        }
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (viewport.compact && event.target === event.currentTarget) close();
      }}>
      <div className="assistant-drawer-shell">
        <header className="assistant-heading" onPointerDown={(event) => start(event, 'move')} {...dragHandlers}
          onContextMenu={(event) => {
            if (viewport.compact) return;
            event.preventDefault();
            showMenu(menuButton.current ?? event.currentTarget, false, { x: event.clientX, y: event.clientY });
          }}>
          <h2 id="assistant-heading">学习智能体</h2>
          <div className="assistant-heading-actions">
            {!viewport.compact && <button ref={menuButton} type="button" className="assistant-close" aria-label="窗口选项"
              aria-expanded={Boolean(menu && !menu.launcher)} onClick={(event) => {
                if (menu && !menu.launcher) setMenu(undefined);
                else showMenu(event.currentTarget, false);
              }}>⋯</button>}
            <button type="button" className="assistant-close" aria-label="最小化学习智能体" title="最小化" onClick={minimize}>−</button>
            <button ref={closeButton} type="button" className="assistant-close" aria-label="关闭学习智能体" onClick={close}>×</button>
          </div>
        </header>
        <div className="assistant-chat-host">
          <AssistantChat source={source} active={open} onAction={runAction}
            resourceQuestion={tab === 'search' ? resourceQuestion : undefined} onOpenResource={minimize}
            review={tab === 'review' && !showPicker && reviewForm && reviewTarget ? {
              id: reviewTarget.id, date: reviewTarget.date,
              reference: reviewReference?.formId === reviewForm && reviewReference.logId === reviewTarget.id ? reviewReference : undefined,
              onRemoveReference: () => setReviewReference(undefined),
              respond: async (question, history, signal) => {
                const panel = reviewPanels.current.get(reviewForm);
                if (!panel) throw new Error('这篇日志正在加载，请稍后再试。');
                return panel.respond(question, history, signal);
              },
            } : undefined}
            growthReference={growthReference} onRemoveGrowthReference={() => setGrowthReference(undefined)}
            codeExcerpt={codeExcerpt} onRemoveCode={() => setCodeExcerpt(undefined)} onPickCode={() => setPickingCode(true)}
            page={activePage} onStart={(page) => { minimize(); onStart(page); }} onTool={() => setPickingCode(true)}
            onReturnToChat={() => { setMode('chat'); setPickingCode(false); focusToolInput(); }}
            toolKey={tab === 'chat' ? (pickingCode ? 'code' : undefined)
              : tab === 'review' ? (showPicker ? 'review-picker' : `review-${reviewTargetId}`) : tab}
            onContextMessage={provideReviewDate} tools={<>
        {pickingCode && <div className="assistant-tool-panel" hidden={tab !== 'chat'}>
          <AssistantCodePicker current={codeExcerpt} onBack={() => setPickingCode(false)} onSelect={askAboutCode} />
        </div>}
        <div className="assistant-tool-panel" hidden={tab !== 'review'}>
          {reviewTarget && <div className="assistant-context">
            <span className="knowledge-muted">{reviewKind ? '当前日志' : '整理日志'} · {reviewTarget.date}</span>
            <button type="button" className="knowledge-text-button" onClick={() => setChoosingLog(!choosingLog)}>
              {choosingLog ? '继续整理当前日志' : '选择其他日期'}
            </button>
          </div>}
          {editingLog && editingLog.log.id !== reviewTargetId && <button type="button" className="knowledge-text-button" onClick={() => {
            setReviewId(editingLog.log.id);
            setChoosingLog(false);
          }}>整理当前草稿</button>}
          {showPicker && <>
            <p className="knowledge-muted">告诉我日志日期，或从下面选一篇。</p>
            <input aria-label="按日期找日志" className="workspace-input assistant-inline-filter" autoComplete="off" placeholder="按日期筛选日志"
              value={dateQuery} maxLength={40} onChange={(event) => setDateQuery(event.target.value)} />
            <AssistantReviewPicker query={dateQuery} onSelect={(log) => selectReviewLog(log.id)} />
          </>}
          <div ref={setToday} hidden={showPicker || reviewKind !== 'today'} />
          <div ref={setHistory} hidden={showPicker || reviewKind !== 'history'} />
          {reviewLogs.map((log) => <div key={log.id} hidden={showPicker || Boolean(reviewKind) || log.id !== reviewTargetId}>
            <LogReviewPanel logId={log.id} date={log.date} content={log.content} formId={savedReviewForm(log.id)}
              onApply={(suggestions, original) => useKnowledgeStore.getState().saveReviewedLog(log.id, original, original, suggestions)} />
          </div>)}
        </div>
        {tab === 'search' && <div className="assistant-tool-panel">
          <AssistantSearch query={searchQuery} scope={searchScope} context={resourceQuestion} onQuery={setSearchQuery}
            onScope={setSearchScope} onNavigate={minimize} />
        </div>}
        <div className="assistant-tool-panel" hidden={tab !== 'recommend'}>
          <input className="workspace-input assistant-inline-filter" aria-label="练习偏好（可选）" placeholder="练习偏好（可选）"
            value={recommendationFocus} onChange={(event) => setRecommendationFocus(event.target.value)} maxLength={180} />
          <GrowthSuggestions domain={recommendationDomain} focus={recommendationFocus} recentLogs={recommendationRecentLogs} onDomain={setRecommendationDomain}
            groupId={recommendationGroupId} groupName={recommendationGroup?.name}
            onNavigate={minimize} recordDisabledReason={editingGrowth ? '请先保存或取消正在编辑的卡片或实践。' : growthError || (!growthLoaded ? '正在加载成长记录…' : undefined)}
            onRecord={(item) => { minimize(); onRecordRecommendation(item, recommendationGroupId); }} />
        </div>
        </>} />
        </div>
      </div>
      {!viewport.compact && <button type="button" className="assistant-resize" aria-label="调整智能体窗口大小"
        title="拖动调整大小，也可用方向键" onPointerDown={(event) => start(event, 'resize')} {...dragHandlers}
        onKeyDown={(event) => {
          const dx = event.key === 'ArrowRight' ? 20 : event.key === 'ArrowLeft' ? -20 : 0;
          const dy = event.key === 'ArrowDown' ? 20 : event.key === 'ArrowUp' ? -20 : 0;
          if (!dx && !dy) return;
          event.preventDefault();
          saveFrame(resizeFrame(windowFrame, dx, dy, viewport));
        }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><path d="m3 13 10-10M8 13l5-5" /></svg>
      </button>}
      {menu && !menu.launcher && operations}
    </dialog>
  </AssistantSlots.Provider>;
}
