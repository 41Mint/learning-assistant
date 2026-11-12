import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent, MouseEvent, PointerEvent, ReactNode, Ref } from 'react';
import { layoutKnowledgeNetwork, NETWORK_NODE_HEIGHT, NETWORK_NODE_WIDTH, networkLine, selectedNetworkLine } from '../../utils/knowledgeNetwork';
import type { NetworkBounds, Position } from '../../utils/knowledgeNetwork';
import { relationLabel, relationNodeKey, RELATION_KIND_LABELS } from '../../utils/relations';
import type { RelationConnection, RelationNode } from '../../utils/relations';
import { NetworkToolButton } from './NetworkToolbar';

export interface KnowledgeNetworkCanvasHandle { fit: () => void }

interface Props {
  ref: Ref<KnowledgeNetworkCanvasHandle>;
  nodes: RelationNode[];
  connections: RelationConnection[];
  selectedNode?: RelationNode;
  selectedConnection?: RelationConnection;
  focusRequest: number;
  matches: Set<string> | null;
  connecting?: { first?: RelationNode; second?: RelationNode };
  toolbar: ReactNode;
  onNode: (node: RelationNode) => void;
  onOpenNode: (node: RelationNode) => void;
  onConnection: (connection: RelationConnection) => void;
  onNewEntry: () => void;
  onHideModule: (category: string) => void;
  onOnlyModule: (category: string) => void;
}

interface NodeDrag {
  pointer: number;
  key: string;
  start: Position;
  origin: Position;
  automatic: Position;
  zoom: number;
  moved: boolean;
}

interface NetworkView extends Position { zoom: number }
interface ViewportSize { width: number; height: number }
const MAX_ZOOM = 1.8;

function fitNetworkView(bounds: NetworkBounds, { width, height }: ViewportSize): NetworkView {
  return {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
    zoom: width && height ? Math.min(1, Math.max(1, width - 16) / (bounds.right - bounds.left),
      Math.max(1, height - 16) / (bounds.bottom - bounds.top)) : 1,
  };
}

export default function KnowledgeNetworkCanvas({
  ref, nodes, connections, selectedNode, selectedConnection, focusRequest, matches, connecting, toolbar,
  onNode, onOpenNode, onConnection, onNewEntry, onHideModule, onOnlyModule,
}: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const contextMenu = useRef<HTMLDivElement>(null);
  const clickTimer = useRef<number | undefined>(undefined);
  const pan = useRef<{ pointer: number; start: Position; view: NetworkView } | null>(null);
  const drag = useRef<NodeDrag | null>(null);
  const skipClick = useRef(false);
  const lastDrag = useRef(-Infinity);
  const [size, setSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [manualView, setManualView] = useState<NetworkView | null>(null);
  const [offsets, setOffsets] = useState<Record<string, Position>>({});
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [menu, setMenu] = useState<(Position & { category: string | null }) | null>(null);
  const aspectRatio = size.width && size.height ? size.width / size.height : 1.65;
  const automatic = useMemo(() => layoutKnowledgeNetwork(nodes, connections, aspectRatio), [nodes, connections, aspectRatio]);
  const layout = useMemo(() => {
    if (!Object.keys(offsets).length) return automatic;
    const positions = new Map(automatic.positions);
    const bounds = { ...automatic.bounds };
    for (const [node, position] of positions) {
      const offset = offsets[relationNodeKey(node)];
      if (!offset) continue;
      const moved = { x: position.x + offset.x, y: position.y + offset.y };
      positions.set(node, moved);
      bounds.left = Math.min(bounds.left, moved.x - 16);
      bounds.top = Math.min(bounds.top, moved.y - 16);
      bounds.right = Math.max(bounds.right, moved.x + NETWORK_NODE_WIDTH + 16);
      bounds.bottom = Math.max(bounds.bottom, moved.y + NETWORK_NODE_HEIGHT + 16);
    }
    return { ...automatic, positions, bounds };
  }, [automatic, offsets]);
  const lines = useMemo(() => {
    const ordered = selectedConnection ? [...connections.filter((item) => item !== selectedConnection), selectedConnection] : connections;
    return ordered.flatMap((connection) => {
      const first = layout.positions.get(connection.first);
      const second = layout.positions.get(connection.second);
      if (!first || !second) return [];
      const line = connection === selectedConnection && !draggingKey ? selectedNetworkLine(first, second, layout) : networkLine(first, second);
      return [{ connection, ...line }];
    });
  }, [layout, connections, selectedConnection, draggingKey]);
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
  }, [fitView, minZoom]);
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
  useImperativeHandle(ref, () => ({ fit: () => setManualView(null) }), []);

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
    const edgePosition = selectedConnection && lines.find((line) => line.connection === selectedConnection);
    const position = edgePosition ?? (selectedNode && layout.positions.get(selectedNode));
    if (!position || !size.width || !size.height || pan.current || drag.current?.moved) return;
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
  }, [layout, lines, selectedConnection, selectedNode, size, focusRequest]);

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || !(event.target instanceof Element)
      || event.target.closest('button, [data-network-line]')) return;
    const element = event.currentTarget;
    window.clearTimeout(clickTimer.current);
    pan.current = { pointer: event.pointerId, start: { x: event.clientX, y: event.clientY }, view };
    element.setPointerCapture(event.pointerId);
    element.focus({ preventScroll: true });
    event.preventDefault();
  };
  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    const start = pan.current;
    if (start?.pointer !== event.pointerId) return;
    setManualView({ x: start.view.x - (event.clientX - start.start.x) / start.view.zoom,
      y: start.view.y - (event.clientY - start.start.y) / start.view.zoom, zoom: start.view.zoom });
  };
  const endPan = (event: PointerEvent<HTMLDivElement>) => {
    if (pan.current?.pointer === event.pointerId) pan.current = null;
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

  const startDrag = (event: PointerEvent<HTMLButtonElement>, node: RelationNode, origin: Position) => {
    skipClick.current = false;
    if (connecting || event.button !== 0 || !event.isPrimary) return;
    const base = automatic.positions.get(node);
    if (!base) return;
    drag.current = { pointer: event.pointerId, key: relationNodeKey(node), start: { x: event.clientX, y: event.clientY }, origin, automatic: base, zoom, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (current?.pointer !== event.pointerId) return;
    const dx = event.clientX - current.start.x;
    const dy = event.clientY - current.start.y;
    if (!current.moved) {
      if (Math.hypot(dx, dy) < 5) return;
      current.moved = true;
      window.clearTimeout(clickTimer.current);
      setManualView((previous) => previous ?? fitView);
      setDraggingKey(current.key);
    }
    const position = { x: current.origin.x + dx / current.zoom, y: current.origin.y + dy / current.zoom };
    setOffsets((previous) => ({ ...previous, [current.key]: { x: position.x - current.automatic.x, y: position.y - current.automatic.y } }));
  };
  const endDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (current?.pointer !== event.pointerId) return;
    drag.current = null;
    if (current.moved) {
      skipClick.current = true;
      lastDrag.current = performance.now();
      setDraggingKey(null);
    }
  };
  const showContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    if (connecting || !(event.target instanceof Element) || event.target.closest('button, [data-network-line]')) return;
    const bounds = frame.current?.getBoundingClientRect();
    if (!bounds) return;
    const category = event.target.closest<HTMLElement>('[data-network-module]')?.dataset.networkModule ?? null;
    event.preventDefault();
    setMenu({ category, x: Math.max(4, Math.min(event.clientX - bounds.left, bounds.width - 154)),
      y: Math.max(4, Math.min(event.clientY - bounds.top, bounds.height - (category === null ? 48 : 110))) });
  };
  const menuCategory = menu?.category ?? null;

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
          <NetworkToolButton icon="reset" label="重置节点位置" disabled={!Object.keys(offsets).length || Boolean(connecting)} onClick={() => setOffsets({})} />
        </div>
      </div>
      <div ref={viewport} className="network-viewport" role="group" aria-label="知识网络图" tabIndex={0}
        aria-description="拖动空白处平移，按住 Ctrl 滚动滚轮缩放。"
        style={{ backgroundPosition: `${origin.x}px ${origin.y}px` }}
        onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onLostPointerCapture={endPan}
        onKeyDown={panWithKeys} onFocusCapture={revealFocusedButton} onContextMenu={showContextMenu}>
        <div className="network-board" data-focused={focused || undefined}
          style={{ width: automatic.bounds.right, height: automatic.bounds.bottom, transform: `translate(${origin.x}px, ${origin.y}px) scale(${zoom})` }}>
          {layout.panels.map((panel) => <div key={panel.key} className="network-group" aria-hidden="true" data-network-module={panel.category ?? undefined}
            style={{ left: panel.x, top: panel.y, width: panel.width, height: panel.height }}>
            <span title={panel.category === null ? undefined : '右键调整模块可见性'}>{panel.title}</span>
          </div>)}
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
            return <button type="button" key={key} className="relation-node network-node" data-kind={node.kind}
              data-active={endpoint || activeNodes.has(node) || undefined} data-match={matches?.has(key) || undefined} data-dragging={draggingKey === key || undefined}
              title={[node.title, node.detail, connecting ? '选择端点' : '双击打开 · 拖动移动'].filter(Boolean).join(' · ')}
              aria-pressed={connecting ? endpoint : node === selectedNode}
              aria-keyshortcuts={connecting ? undefined : 'Enter'}
              style={{ left: position.x, top: position.y, width: NETWORK_NODE_WIDTH, height: NETWORK_NODE_HEIGHT }}
              onPointerDown={(event) => startDrag(event, node, position)} onPointerMove={moveDrag}
              onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
              onClick={(event) => {
                window.clearTimeout(clickTimer.current);
                if (skipClick.current && event.detail > 0) return;
                if (connecting || event.detail === 0) onNode(node);
                else if (event.detail === 1) clickTimer.current = window.setTimeout(() => onNode(node), 240);
              }} onDoubleClick={() => {
                window.clearTimeout(clickTimer.current);
                if (!connecting && performance.now() - lastDrag.current > 350) onOpenNode(node);
              }}
              onKeyDown={(event) => {
                if (!connecting && event.key === 'Enter') { event.preventDefault(); onOpenNode(node); }
              }}>
              <strong>{node.title}</strong>
              {node.kind !== 'entry' && <small>{node.detail || RELATION_KIND_LABELS[node.kind]}</small>}
            </button>;
          })}
        </div>
      </div>
      {menu && <div ref={contextMenu} className="network-context-menu" role="menu" aria-label="画布操作" style={{ left: menu.x, top: menu.y }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          setMenu(null);
          viewport.current?.focus({ preventScroll: true });
        }}>
        {menuCategory === null
          ? <button type="button" role="menuitem" onClick={() => { setMenu(null); onNewEntry(); }}>新建词条</button>
          : <>
            <div className="network-context-menu-title">{menuCategory || '未分类'}</div>
            <button type="button" role="menuitem" onClick={() => {
              onHideModule(menuCategory);
              setMenu(null);
              viewport.current?.focus({ preventScroll: true });
            }}>隐藏此模块</button>
            <button type="button" role="menuitem" onClick={() => {
              onOnlyModule(menuCategory);
              setMenu(null);
              viewport.current?.focus({ preventScroll: true });
            }}>仅显示此模块</button>
          </>}
      </div>}
    </div>
  );
}
