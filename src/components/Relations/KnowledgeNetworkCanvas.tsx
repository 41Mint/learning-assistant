import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent, MouseEvent, PointerEvent, ReactNode, Ref } from 'react';
import { applyNetworkLayout, emptyNetworkLayout, layoutKnowledgeNetwork, NETWORK_NODE_HEIGHT, NETWORK_NODE_WIDTH,
  networkLine, networkModuleKey, selectedNetworkLine, translateNetworkLayout } from '../../utils/knowledgeNetwork';
import type { NetworkBounds, NetworkLayers, NetworkLayoutEdits, NetworkMoveTarget, Position } from '../../utils/knowledgeNetwork';
import { relationLabel, relationNodeKey, RELATION_KIND_LABELS } from '../../utils/relations';
import type { RelationConnection, RelationNode } from '../../utils/relations';
import { NetworkToolButton } from './NetworkToolbar';

export interface KnowledgeNetworkCanvasHandle { fit: () => void; fitSelection: () => void; interacting: () => boolean }

interface Props {
  ref: Ref<KnowledgeNetworkCanvasHandle>;
  nodes: RelationNode[];
  connections: RelationConnection[];
  selectedNode?: RelationNode;
  selectedConnection?: RelationConnection;
  selectedKeys: ReadonlySet<string>;
  selectionOnly: boolean;
  edits: NetworkLayoutEdits;
  focusRequest: number;
  matches: Set<string> | null;
  connecting?: { first?: RelationNode; second?: RelationNode };
  toolbar: ReactNode;
  onNode: (node: RelationNode) => void;
  onOpenNode: (node: RelationNode) => void;
  onConnection: (connection: RelationConnection) => void;
  onBlankClick: () => void;
  onNewEntry: () => void;
  onEditEntry: (id: string) => void;
  onRenameModule: (category: string) => void;
  onEditMembers: (category: string) => void;
  onHideModule: (category: string) => void;
  onOnlyModule: (category: string) => void;
  onHideLayer: (layer: keyof NetworkLayers) => void;
  onToggleSelection: (node: RelationNode) => void;
  onBoxSelection: (keys: string[]) => void;
  onLayoutEdit: (edits: NetworkLayoutEdits, label: string) => void;
}

interface LayoutDrag {
  pointer: number;
  target: NetworkMoveTarget;
  before: NetworkLayoutEdits;
  start: Position;
  zoom: number;
  moved: boolean;
}

type ModuleTarget = { kind: 'module'; category: string } | { kind: 'layer'; layer: keyof NetworkLayers };
type MenuTarget = { kind: 'blank' } | { kind: 'entry'; id: string } | ModuleTarget;
interface NetworkView extends Position { zoom: number }
interface ViewportSize { width: number; height: number }
const MAX_ZOOM = 1.8;
const DRAG_THRESHOLD = 5;

function selectionBounds(element: HTMLDivElement, start: Position, end: Position): NetworkBounds {
  const rect = element.getBoundingClientRect();
  const x = (value: number) => Math.max(0, Math.min(element.clientWidth, value - rect.left - element.clientLeft));
  const y = (value: number) => Math.max(0, Math.min(element.clientHeight, value - rect.top - element.clientTop));
  return { left: x(Math.min(start.x, end.x)), top: y(Math.min(start.y, end.y)),
    right: x(Math.max(start.x, end.x)), bottom: y(Math.max(start.y, end.y)) };
}

function fitNetworkView(bounds: NetworkBounds, { width, height }: ViewportSize): NetworkView {
  return {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
    zoom: width && height ? Math.min(1, Math.max(1, width - 16) / (bounds.right - bounds.left),
      Math.max(1, height - 16) / (bounds.bottom - bounds.top)) : 1,
  };
}

export default function KnowledgeNetworkCanvas({
  ref, nodes, connections, selectedNode, selectedConnection, selectedKeys, selectionOnly, edits, focusRequest, matches, connecting, toolbar,
  onNode, onOpenNode, onConnection, onBlankClick, onNewEntry, onEditEntry, onRenameModule, onEditMembers, onHideModule, onOnlyModule, onHideLayer,
  onToggleSelection, onBoxSelection, onLayoutEdit,
}: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const contextMenu = useRef<HTMLDivElement>(null);
  const clickTimer = useRef<number | undefined>(undefined);
  const lastFocus = useRef<{ key: string; request: number } | null>(null);
  const pan = useRef<{ pointer: number; start: Position; view: NetworkView; box: boolean; moved: boolean; blankClick: boolean } | null>(null);
  const drag = useRef<LayoutDrag | null>(null);
  const skipClick = useRef(false);
  const lastDrag = useRef(-Infinity);
  const [size, setSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [networkView, setNetworkView] = useState<NetworkView | null>(null);
  const [selectionView, setSelectionView] = useState<NetworkView | null>(null);
  const manualView = selectionOnly ? selectionView : networkView;
  const setManualView = selectionOnly ? setSelectionView : setNetworkView;
  const [preview, setPreview] = useState<{ edits: NetworkLayoutEdits; target: NetworkMoveTarget } | null>(null);
  const [selectionBox, setSelectionBox] = useState<NetworkBounds | null>(null);
  const [menu, setMenu] = useState<(Position & { target: MenuTarget }) | null>(null);
  const aspectRatio = size.width && size.height ? size.width / size.height : 1.65;
  const automatic = useMemo(() => layoutKnowledgeNetwork(nodes, connections, aspectRatio), [nodes, connections, aspectRatio]);
  const shownEdits = preview?.edits ?? edits;
  const layout = useMemo(() => applyNetworkLayout(automatic, shownEdits), [automatic, shownEdits]);
  const lines = useMemo(() => {
    const ordered = selectedConnection ? [...connections.filter((item) => item !== selectedConnection), selectedConnection] : connections;
    return ordered.flatMap((connection) => {
      const first = layout.positions.get(connection.first);
      const second = layout.positions.get(connection.second);
      if (!first || !second) return [];
      const line = connection === selectedConnection && !preview ? selectedNetworkLine(first, second, layout) : networkLine(first, second);
      return [{ connection, ...line }];
    });
  }, [layout, connections, selectedConnection, preview]);
  const fitView = useMemo(() => fitNetworkView(layout.bounds, size), [layout.bounds, size]);
  const view = manualView ?? fitView;
  const zoom = view.zoom;
  const minZoom = Math.min(fitView.zoom, 0.1);
  const origin = { x: size.width / 2 - view.x * zoom, y: size.height / 2 - view.y * zoom };
  const bounds = layout.bounds;
  const lineWidth = bounds.right - bounds.left;
  const lineHeight = bounds.bottom - bounds.top;
  const changeZoom = useCallback((scale: (zoom: number) => number, anchor: Position = { x: 0, y: 0 }) => {
    setManualView((previous) => {
      const current = previous ?? fitView;
      const next = Math.max(minZoom, Math.min(MAX_ZOOM, scale(current.zoom)));
      if (next === current.zoom) return previous;
      // Keep the world position under the pointer fixed as the zoom changes.
      const delta = 1 / current.zoom - 1 / next;
      return { x: current.x + anchor.x * delta, y: current.y + anchor.y * delta, zoom: next };
    });
  }, [fitView, minZoom, setManualView]);
  const focused = !connecting && Boolean(selectedNode || selectedConnection);
  const activeNodes = new Set(selectedNode ? [selectedNode] : []);
  const activeConnections = new Set(connections.filter((connection) => selectedConnection
    ? connection === selectedConnection : selectedNode && (connection.first === selectedNode || connection.second === selectedNode)));
  for (const { first, second } of activeConnections) {
    activeNodes.add(first);
    activeNodes.add(second);
  }
  const draftStart = connecting?.first && layout.positions.get(connecting.first);
  const draftEnd = connecting?.second && layout.positions.get(connecting.second);
  const previewLine = draftStart && draftEnd ? networkLine(draftStart, draftEnd).path : undefined;
  useEffect(() => () => window.clearTimeout(clickTimer.current), []);
  useImperativeHandle(ref, () => ({
    fit: () => setNetworkView(null),
    fitSelection: () => setSelectionView(null),
    interacting: () => Boolean(pan.current || drag.current),
  }), []);

  useEffect(() => {
    if (!menu) return;
    contextMenu.current?.querySelector('button')?.focus({ preventScroll: true });
    const dismiss = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && !contextMenu.current?.contains(event.target)) setMenu(null);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [menu]);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const resize = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (!width || !height) return;
      setSize((previous) => previous.width === width && previous.height === height ? previous : { width, height });
    };
    const observer = new ResizeObserver(resize);
    resize();
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (pan.current || drag.current || !event.deltaY) return;
      const rect = element.getBoundingClientRect();
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? rect.height : 1;
      const factor = Math.exp(-event.deltaY * unit / 500);
      changeZoom((current) => current * factor, { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 });
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [changeZoom]);

  useEffect(() => {
    const key = selectedConnection ? 'connection:' + selectedConnection.key : selectedNode && relationNodeKey(selectedNode);
    if (!key) {
      lastFocus.current = null;
      return;
    }
    if (lastFocus.current?.key === key && lastFocus.current.request === focusRequest) return;
    const edgePosition = selectedConnection && lines.find((line) => line.connection === selectedConnection);
    const position = edgePosition ?? (selectedNode && layout.positions.get(selectedNode));
    if (!position || !size.width || !size.height || pan.current || drag.current?.moved) return;
    lastFocus.current = { key, request: focusRequest };
    const halfWidth = edgePosition ? 0 : NETWORK_NODE_WIDTH / 2;
    const halfHeight = edgePosition ? 0 : NETWORK_NODE_HEIGHT / 2;
    const x = position.x + halfWidth;
    const y = position.y + halfHeight;
    setManualView((current) => {
      if (!current) return current;
      const fitsHorizontally = (Math.abs(x - current.x) + halfWidth) * current.zoom <= size.width / 2;
      const fitsVertically = (Math.abs(y - current.y) + halfHeight) * current.zoom <= size.height / 2;
      return fitsHorizontally && fitsVertically ? current : { x, y, zoom: current.zoom };
    });
  }, [layout, lines, selectedConnection, selectedNode, size, focusRequest, setManualView]);

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current || !event.isPrimary || event.button !== 0 || !(event.target instanceof Element)
      || event.target.closest('button, [data-network-line]')) return;
    const element = event.currentTarget;
    window.clearTimeout(clickTimer.current);
    pan.current = {
      pointer: event.pointerId, start: { x: event.clientX, y: event.clientY }, view,
      box: event.shiftKey && !connecting, moved: false,
      blankClick: !connecting && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey,
    };
    element.setPointerCapture(event.pointerId);
    element.focus({ preventScroll: true });
    event.preventDefault();
  };
  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    const start = pan.current;
    if (start?.pointer !== event.pointerId) return;
    const dx = event.clientX - start.start.x;
    const dy = event.clientY - start.start.y;
    if (!start.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    start.moved = true;
    if (start.box) {
      setSelectionBox(selectionBounds(event.currentTarget, start.start, { x: event.clientX, y: event.clientY }));
      return;
    }
    setManualView({ x: start.view.x - dx / start.view.zoom, y: start.view.y - dy / start.view.zoom, zoom: start.view.zoom });
  };
  const endPan = (event: PointerEvent<HTMLDivElement>) => {
    const start = pan.current;
    if (start?.pointer !== event.pointerId) return;
    pan.current = null;
    if (start.box) setSelectionBox(null);
    if (event.type !== 'pointerup') return;
    const end = { x: event.clientX, y: event.clientY };
    const moved = Math.hypot(end.x - start.start.x, end.y - start.start.y) >= DRAG_THRESHOLD;
    if (!start.box) {
      if (!moved && !start.moved && start.blankClick) onBlankClick();
      return;
    }
    if (!moved) return;
    const box = selectionBounds(event.currentTarget, start.start, end);
    const keys: string[] = [];
    for (const [node, position] of layout.positions) {
      const x = origin.x + position.x * zoom;
      const y = origin.y + position.y * zoom;
      if (x <= box.right && x + NETWORK_NODE_WIDTH * zoom >= box.left
        && y <= box.bottom && y + NETWORK_NODE_HEIGHT * zoom >= box.top) keys.push(relationNodeKey(node));
    }
    if (keys.length) onBoxSelection(keys);
  };
  const panWithKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
    const directions: Record<string, Position> = {
      ArrowLeft: { x: -64, y: 0 }, ArrowRight: { x: 64, y: 0 }, ArrowUp: { x: 0, y: -64 }, ArrowDown: { x: 0, y: 64 },
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    setManualView((previous) => {
      const current = previous ?? fitView;
      return { x: current.x + direction.x / current.zoom, y: current.y + direction.y / current.zoom, zoom: current.zoom };
    });
  };
  const revealFocusedButton = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.matches(':focus-visible')) return;
    const area = event.currentTarget.getBoundingClientRect();
    const button = target.getBoundingClientRect();
    if (button.left >= area.left && button.right <= area.right && button.top >= area.top && button.bottom <= area.bottom) return;
    const x = button.left + button.width / 2 - area.left - area.width / 2;
    const y = button.top + button.height / 2 - area.top - area.height / 2;
    setManualView({ x: view.x + x / zoom, y: view.y + y / zoom, zoom });
  };

  const startDrag = (event: PointerEvent<HTMLButtonElement>, target: NetworkMoveTarget) => {
    skipClick.current = false;
    if (connecting || pan.current || event.button !== 0 || !event.isPrimary || event.shiftKey) return;
    drag.current = { pointer: event.pointerId, target, before: edits, start: { x: event.clientX, y: event.clientY }, zoom, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (current?.pointer !== event.pointerId) return;
    const dx = event.clientX - current.start.x;
    const dy = event.clientY - current.start.y;
    if (!current.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      current.moved = true;
      window.clearTimeout(clickTimer.current);
      setManualView((previous) => previous ?? fitView);
    }
    setPreview({ target: current.target,
      edits: translateNetworkLayout(current.before, current.target, { x: dx / current.zoom, y: dy / current.zoom }) });
  };
  const endDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (current?.pointer !== event.pointerId) return;
    drag.current = null;
    if (current.moved) {
      skipClick.current = true;
      lastDrag.current = performance.now();
      setPreview(null);
      const dx = event.clientX - current.start.x;
      const dy = event.clientY - current.start.y;
      if (event.type === 'pointerup' && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
        const next = translateNetworkLayout(current.before, current.target, { x: dx / current.zoom, y: dy / current.zoom });
        const label = current.target.kind === 'module' ? '移动模块' : current.target.keys.length > 1 ? '移动所选节点' : '移动节点';
        onLayoutEdit(next, label);
      }
    }
  };
  const openMenu = (target: MenuTarget, x: number, y: number) => {
    const bounds = frame.current?.getBoundingClientRect();
    if (!bounds) return;
    setMenu({ target, x: Math.max(4, Math.min(x - bounds.left, bounds.width - 154)),
      y: Math.max(4, Math.min(y - bounds.top, bounds.height - (target.kind === 'module' ? 178 : target.kind === 'layer' ? 80 : 48))) });
  };
  const closeMenu = () => {
    setMenu(null);
    viewport.current?.focus({ preventScroll: true });
  };
  const showContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    if (connecting || !(event.target instanceof Element) || event.target.closest('[data-network-line]')) return;
    const entry = event.target.closest<HTMLElement>('[data-network-entry]')?.dataset.networkEntry;
    const group = event.target.closest<HTMLElement>('[data-network-module], [data-network-layer]')?.dataset;
    const category = group?.networkModule;
    const layer = group?.networkLayer;
    const target: MenuTarget = entry !== undefined ? { kind: 'entry', id: entry }
      : category !== undefined ? { kind: 'module', category }
      : layer === 'log' || layer === 'code' ? { kind: 'layer', layer } : { kind: 'blank' };
    if (target.kind === 'blank' && event.target.closest('button')) return;
    event.preventDefault();
    openMenu(target, event.clientX, event.clientY);
  };
  const moveTarget = preview?.target;
  const menuEntry = menu?.target.kind === 'entry' ? menu.target.id : undefined;
  const menuCategory = menu?.target.kind === 'module' ? menu.target.category : undefined;
  const menuLayer = menu?.target.kind === 'layer' ? menu.target.layer : undefined;

  return (
    <div ref={frame} className="network-canvas" data-connecting={Boolean(connecting) || undefined}>
      <div className="network-canvas-toolbar">
        {toolbar}
        <div className="network-zoom" role="group" aria-label="网络缩放">
          <button type="button" aria-label="缩小知识网络" disabled={zoom <= minZoom + 0.001}
            onClick={() => changeZoom((current) => current / 1.25)}>−</button>
          <button type="button" aria-label="恢复实际大小" title="恢复实际大小 · Ctrl + 滚轮缩放" onClick={() => changeZoom(() => 1)}>{Math.round(zoom * 100)}%</button>
          <button type="button" aria-label="放大知识网络" disabled={zoom >= MAX_ZOOM}
            onClick={() => changeZoom((current) => current * 1.25)}>＋</button>
          <button type="button" onClick={() => setManualView(null)}>适应窗口</button>
          <NetworkToolButton icon="reset" label="重置节点位置" disabled={(!edits.nodes.size && !edits.modules.size) || Boolean(connecting)}
            onClick={() => onLayoutEdit(emptyNetworkLayout, '重置布局')} />
        </div>
      </div>
      <div ref={viewport} className="network-viewport" role="group" aria-label="知识网络图" tabIndex={0}
        aria-description="单击空白处退出连线详情或多选中的节点详情。拖动空白处平移，Ctrl 加滚轮缩放。Shift 加单击多选，按住 Shift 从空白处拖动框选。"
        style={{ backgroundPosition: `${origin.x}px ${origin.y}px` }}
        onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onLostPointerCapture={endPan}
        onKeyDown={panWithKeys} onFocusCapture={revealFocusedButton} onContextMenu={showContextMenu}>
        <div className="network-board" data-focused={focused || undefined}
          style={{ width: automatic.bounds.right, height: automatic.bounds.bottom, transform: `translate(${origin.x}px, ${origin.y}px) scale(${zoom})` }}>
          {layout.panels.map((panel) => {
            const category = panel.category;
            const target: ModuleTarget = panel.kind === 'entry' ? { kind: 'module', category: category ?? '' } : { kind: 'layer', layer: panel.kind };
            return <div key={panel.key} className="network-group" data-network-module={category ?? undefined} data-network-layer={category === null ? panel.kind : undefined}
              style={{ left: panel.x, top: panel.y, width: panel.width, height: panel.height }}>
              <button type="button" className="network-module-handle" aria-label={`管理模块 ${panel.title}`} aria-haspopup="menu"
                disabled={Boolean(connecting)} title="拖动移动模块 · 单击或右键管理"
                data-dragging={moveTarget?.kind === 'module' && moveTarget.key === panel.key || undefined}
                onPointerDown={(event) => startDrag(event, { kind: 'module', key: panel.key })} onPointerMove={moveDrag}
                onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
                onClick={(event) => {
                  if (skipClick.current && event.detail > 0) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  openMenu(target, rect.left, rect.bottom);
                }}>{panel.title}</button>
            </div>;
          })}
          <svg className="network-lines" viewBox={`${bounds.left} ${bounds.top} ${lineWidth} ${lineHeight}`} aria-hidden="true"
            style={{ left: bounds.left, top: bounds.top, width: lineWidth, height: lineHeight }}>
            {lines.map(({ connection, path }) => <g key={connection.key} data-active={activeConnections.has(connection) || undefined}>
              <path className="network-line" d={path} />
              <path className="network-line-hit" d={path} data-network-line onClick={() => onConnection(connection)} />
            </g>)}
            {previewLine && <path className="network-draft-line" d={previewLine} />}
          </svg>
          {lines.map(({ connection, x, y, labelWidth }) => {
            const showLabel = connection === selectedConnection
              || (activeConnections.has(connection) && activeConnections.size <= 12)
              || (selectionOnly && connections.length <= 12)
              || (!focused && connection.annotation?.label && connections.length <= 14);
            if (!showLabel) return null;
            const label = relationLabel(connection);
            return <button type="button" key={connection.key} className="network-edge-label" style={{ left: x, top: y, maxWidth: labelWidth }} title={label}
              aria-label={`查看 ${connection.first.title} 与 ${connection.second.title} 的关系（${label}）`}
              aria-pressed={connection === selectedConnection} onClick={() => onConnection(connection)}>{label}</button>;
          })}
          {nodes.map((node) => {
            const position = layout.positions.get(node);
            if (!position) return null;
            const endpoint = connecting?.first === node || connecting?.second === node;
            const key = relationNodeKey(node);
            const batchSelected = selectedKeys.has(key);
            const intermediate = selectionOnly && !batchSelected;
            const moving = moveTarget?.kind === 'module' ? networkModuleKey(node.kind, node.detail) === moveTarget.key
              : moveTarget?.keys.includes(key);
            return <button type="button" key={key} className="relation-node network-node" data-kind={node.kind}
              data-active={endpoint || activeNodes.has(node) || undefined} data-match={matches?.has(key) || undefined} data-dragging={moving || undefined}
              data-network-entry={node.kind === 'entry' ? node.id : undefined} data-intermediate={intermediate || undefined}
              title={[node.title, node.detail, connecting ? '选择端点' : '双击打开 · Shift 单击多选 · 拖动移动'].filter(Boolean).join(' · ')}
              aria-pressed={connecting ? endpoint : batchSelected || !selectionOnly && node === selectedNode}
              aria-description={intermediate ? '中间节点' : undefined}
              aria-keyshortcuts={connecting ? undefined : node.kind === 'entry' ? 'Enter Shift+F10' : 'Enter'}
              style={{ left: position.x, top: position.y, width: NETWORK_NODE_WIDTH, height: NETWORK_NODE_HEIGHT }}
              onPointerDown={(event) => startDrag(event, { kind: 'nodes', keys: batchSelected ? [...selectedKeys] : [key] })} onPointerMove={moveDrag}
              onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
              onClick={(event) => {
                window.clearTimeout(clickTimer.current);
                if (skipClick.current && event.detail > 0) return;
                if (event.shiftKey && !connecting) onToggleSelection(node);
                else if (connecting || event.detail === 0) onNode(node);
                else if (event.detail === 1) clickTimer.current = window.setTimeout(() => onNode(node), 240);
              }} onDoubleClick={(event) => {
                window.clearTimeout(clickTimer.current);
                if (!connecting && !event.shiftKey && performance.now() - lastDrag.current > 350) onOpenNode(node);
              }}
              onKeyDown={(event) => {
                if (connecting) return;
                if (event.key === 'Enter') { event.preventDefault(); onOpenNode(node); }
                if (node.kind === 'entry' && (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10')) {
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  openMenu({ kind: 'entry', id: node.id }, rect.left, rect.bottom);
                }
              }}>
              <strong>{node.title}</strong>
              {node.kind !== 'entry' && <small>{node.detail || RELATION_KIND_LABELS[node.kind]}</small>}
            </button>;
          })}
        </div>
        {selectionBox && <div className="network-selection-box" aria-hidden="true"
          style={{ left: selectionBox.left, top: selectionBox.top, width: selectionBox.right - selectionBox.left,
            height: selectionBox.bottom - selectionBox.top }} />}
      </div>
      {menu && <div ref={contextMenu} className="network-context-menu" role="menu" aria-label="画布操作" style={{ left: menu.x, top: menu.y }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          closeMenu();
        }}>
        {menu.target.kind === 'blank' && <button type="button" role="menuitem" onClick={() => { closeMenu(); onNewEntry(); }}>新建词条</button>}
        {menuEntry !== undefined && <button type="button" role="menuitem" onClick={() => { closeMenu(); onEditEntry(menuEntry); }}>编辑词条</button>}
        {menuCategory !== undefined && <>
          <div className="network-context-menu-title">{menuCategory || '未分类'}</div>
          <button type="button" role="menuitem" onClick={() => { closeMenu(); onRenameModule(menuCategory); }}>重命名分类</button>
          <button type="button" role="menuitem" onClick={() => { closeMenu(); onEditMembers(menuCategory); }}>整理成员</button>
          <button type="button" role="menuitem" onClick={() => { closeMenu(); onHideModule(menuCategory); }}>隐藏此模块</button>
          <button type="button" role="menuitem" onClick={() => { closeMenu(); onOnlyModule(menuCategory); }}>仅显示此模块</button>
        </>}
        {menuLayer && <>
          <div className="network-context-menu-title">{RELATION_KIND_LABELS[menuLayer]}</div>
          <button type="button" role="menuitem" onClick={() => { closeMenu(); onHideLayer(menuLayer); }}>隐藏此模块</button>
        </>}
      </div>}
    </div>
  );
}
