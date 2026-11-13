import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import type { StudyLog } from '../../types';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import { STORAGE_PREFIX } from '../../utils/workspaceMode';
import AssistantChat from './AssistantChat';
import AssistantReviewPicker from './AssistantReviewPicker';
import AssistantSearch from './AssistantSearch';
import type { AssistantAction } from './assistantActions';
import type { SearchScope } from '../Search/ResourceSearch';
import { AssistantSlots } from './assistantSlots';
import type { AssistantLogDraft, AssistantLogKind } from './assistantSlots';
import { assistantViewport, boundFrame, boundPosition, defaultFrame, resizeFrame, windowGap } from './assistantGeometry';
import type { Frame, Point } from './assistantGeometry';

const positionKey = STORAGE_PREFIX + 'assistant-position';
const frameKey = STORAGE_PREFIX + 'assistant-window';
type DragKind = 'launcher' | 'move' | 'resize';
interface Gesture { kind: DragKind; pointer: number; start: Point; origin: Frame; moved: boolean }
interface Menu extends Point { trigger: HTMLElement; launcher: boolean }
const modes = [
  ['chat', '自由问答'], ['review', '日志整理'], ['search', '查找资料'],
] as const;

export default function AssistantDock({ activeLog, onOpenReview, children }: {
  activeLog?: { kind: AssistantLogKind; log: StudyLog; editing: boolean };
  onOpenReview: (log: StudyLog) => string | undefined;
  children: ReactNode;
}) {
  const [today, setToday] = useState<HTMLDivElement | null>(null);
  const [history, setHistory] = useState<HTMLDivElement | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<AssistantLogKind, AssistantLogDraft>>>({});
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [mode, setMode] = useState<typeof modes[number][0]>();
  const [choosingLog, setChoosingLog] = useState(false);
  const [dateQuery, setDateQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
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
  const showPicker = !editingLog || choosingLog;
  const draft = editingLog && drafts[editingLog.kind];
  const source = activeLog && {
    id: activeLog.log.id, date: activeLog.log.date,
    text: draft && draft.id === activeLog.log.id ? draft.text : activeLog.log.content,
    draft: activeLog.editing,
  };
  const windowFrame = preview && preview.kind !== 'launcher' ? preview.frame : frame ? boundFrame(frame, viewport) : defaultFrame(viewport);
  const shown = preview?.kind === 'launcher' ? preview.frame : position && boundPosition(position, 48, 48, viewport);
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
  const slots = useMemo(() => ({ today, history, close, setLogDraft }), [today, history, close, setLogDraft]);

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
    if (!element || !open || (element.open && element.matches(':modal') === viewport.compact)) return;
    const previousFocus = document.activeElement;
    if (element.open) element.close();
    if (viewport.compact) element.showModal();
    else element.show();
    if (previousFocus instanceof HTMLElement && element.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
    else closeButton.current?.focus({ preventScroll: true });
  }, [open, viewport.compact]);

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
    setMinimized(false);
    setOpen(true);
  };
  const runAction = (action: AssistantAction) => {
    if (action.kind === 'review') {
      setMode('review');
      setDateQuery(action.date);
      setChoosingLog(Boolean(action.date));
    } else {
      setMode('search');
      setSearchQuery(action.query);
      setSearchScope('knowledge');
    }
    window.requestAnimationFrame(() => {
      const input = dialog.current?.querySelector<HTMLElement>('.assistant-body:not([hidden]) input[type="search"]');
      (input ?? dialog.current?.querySelector<HTMLElement>('.assistant-modes button[aria-pressed="true"]'))?.focus();
    });
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
      onCancel={(event) => { event.preventDefault(); close(); }}
      onKeyDown={(event) => {
        if (!viewport.compact && event.key === 'Escape' && !event.nativeEvent.isComposing && !event.defaultPrevented) {
          event.preventDefault();
          close();
        }
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
        <div className="assistant-modes" role="group" aria-label="智能体功能">
          {modes.map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value}
            onClick={() => setMode(value)}>{label}</button>)}
        </div>
        <div className="assistant-chat-host" hidden={tab !== 'chat'}>
          <AssistantChat source={source} active={open && tab === 'chat'} onAction={runAction} />
        </div>
        <div className="assistant-body" hidden={tab !== 'review'}>
          {editingLog && <div className="assistant-context">
            <span className="knowledge-muted">当前日志 · {editingLog.log.date}</span>
            <button type="button" className="knowledge-text-button" onClick={() => setChoosingLog(!choosingLog)}>
              {choosingLog ? '继续整理当前日志' : '选择其他日期'}
            </button>
          </div>}
          {showPicker && tab === 'review' && <AssistantReviewPicker query={dateQuery} onQuery={setDateQuery} onSelect={(log) => {
            const error = onOpenReview(log);
            if (!error) setChoosingLog(false);
            return error;
          }} />}
          <div ref={setToday} hidden={showPicker || editingLog?.kind !== 'today'} />
          <div ref={setHistory} hidden={showPicker || editingLog?.kind !== 'history'} />
        </div>
        {tab === 'search' && <div className="assistant-body">
          <AssistantSearch query={searchQuery} scope={searchScope} onQuery={setSearchQuery} onScope={setSearchScope} onNavigate={minimize} />
        </div>}
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
