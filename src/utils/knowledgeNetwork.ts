import type { RelationConnection, RelationNode } from './relations';
import { RELATION_KIND_LABELS } from './relations';

export interface NetworkLayers { log: boolean; code: boolean }

interface NetworkView {
  entries: RelationNode[];
  nodes: RelationNode[];
  connections: RelationConnection[];
}

function adjacency(connections: RelationConnection[]) {
  const neighbors = new Map<RelationNode, RelationNode[]>();
  for (const { first, second } of connections) {
    const from = neighbors.get(first) ?? [];
    const to = neighbors.get(second) ?? [];
    from.push(second);
    to.push(first);
    neighbors.set(first, from);
    neighbors.set(second, to);
  }
  return neighbors;
}

function reachable(roots: RelationNode[], connections: RelationConnection[], hops: number) {
  const neighbors = adjacency(connections);
  const visited = new Set(roots);
  const queue = roots.map((node) => ({ node, distance: 0 }));
  for (let index = 0; index < queue.length; index += 1) {
    const { node, distance } = queue[index];
    if (distance >= hops) break;
    for (const neighbor of neighbors.get(node) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push({ node: neighbor, distance: distance + 1 });
    }
  }
  return visited;
}

export function visibleKnowledgeNetwork(
  nodes: Map<string, RelationNode>, connections: RelationConnection[], categories: readonly string[] | null, layers: NetworkLayers, revealed?: RelationNode,
): NetworkView {
  const allowed = new Set([...nodes.values()].filter((node) => node.kind === 'entry'
    ? categories === null || categories.includes(node.detail ?? '') : layers[node.kind]));
  const entries = [...allowed].filter((node) => node.kind === 'entry');
  const edges = connections.filter(({ first, second }) => allowed.has(first) && allowed.has(second));
  const roots = revealed && revealed.kind !== 'entry' && allowed.has(revealed) ? [...entries, revealed] : entries;
  const visible = reachable(roots, edges, Infinity);
  return { entries, nodes: [...visible], connections: edges.filter(({ first, second }) => visible.has(first) && visible.has(second)) };
}

export function compareKnowledgeModules(network: NetworkView, categories: readonly string[]) {
  const order = new Map(categories.map((category, index) => [category, index]));
  const pairs = new Map<string, { categories: [string, string]; connections: RelationConnection[] }>();
  const resources = new Map<RelationNode, Map<string, RelationConnection[]>>();
  for (const connection of network.connections) {
    const { first, second } = connection;
    const firstCategory = first.kind === 'entry' ? first.detail ?? '' : null;
    const secondCategory = second.kind === 'entry' ? second.detail ?? '' : null;
    if (firstCategory !== null && secondCategory !== null) {
      const firstIndex = order.get(firstCategory);
      const secondIndex = order.get(secondCategory);
      if (firstIndex === undefined || secondIndex === undefined || firstIndex === secondIndex) continue;
      const pair: [string, string] = firstIndex < secondIndex ? [firstCategory, secondCategory] : [secondCategory, firstCategory];
      const key = JSON.stringify(pair);
      const group = pairs.get(key) ?? { categories: pair, connections: [] };
      group.connections.push(connection);
      pairs.set(key, group);
      continue;
    }
    const category = firstCategory ?? secondCategory;
    if (category === null || !order.has(category)) continue;
    const node = firstCategory === null ? first : second;
    const linksByCategory = resources.get(node) ?? new Map<string, RelationConnection[]>();
    const links = linksByCategory.get(category) ?? [];
    links.push(connection);
    linksByCategory.set(category, links);
    resources.set(node, linksByCategory);
  }
  const groups = [...pairs.values()];
  const direct = groups.flatMap(({ connections }) => connections);
  const shared = [...resources].flatMap(([node, linksByCategory]) => linksByCategory.size < 2 ? [] : [{
    node, modules: categories.flatMap((category) => {
      const links = linksByCategory.get(category);
      return links ? [{ category, links }] : [];
    }),
  }]);
  const cross: NetworkView = {
    entries: network.entries,
    nodes: [...network.entries, ...shared.map(({ node }) => node)],
    connections: [...direct, ...shared.flatMap(({ modules }) => modules.flatMap(({ links }) => links))],
  };
  return { groups, directCount: direct.length, shared, cross };
}

export function focusKnowledgeNetwork(network: NetworkView, node: RelationNode | undefined, hops: number): NetworkView {
  if (!node || !hops || !network.nodes.includes(node)) return network;
  const visible = reachable([node], network.connections, hops);
  return {
    entries: network.entries.filter((entry) => visible.has(entry)),
    nodes: [...visible],
    connections: network.connections.filter(({ first, second }) => visible.has(first) && visible.has(second)),
  };
}

export const NETWORK_NODE_WIDTH = 146;
export const NETWORK_NODE_HEIGHT = 48;
const COLUMN_GAP = 64;
const ROW_GAP = 34;
const GROUP_PADDING = 16;
const GROUP_HEADER = 36;
const GROUP_GAP = 24;

export interface Position { x: number; y: number }
export interface NetworkBounds { left: number; top: number; right: number; bottom: number }

export function layoutKnowledgeNetwork(nodes: RelationNode[], connections: RelationConnection[], aspectRatio: number) {
  const neighbors = adjacency(connections);

  const byCategory = new Map<string, RelationNode[]>();
  for (const node of nodes) {
    const key = JSON.stringify([node.kind, node.kind === 'entry' ? node.detail ?? '' : '']);
    const group = byCategory.get(key) ?? [];
    group.push(node);
    byCategory.set(key, group);
  }
  const groups = [...byCategory].map(([key, group]) => {
    const kind = group[0].kind;
    const category = kind === 'entry' ? group[0].detail ?? '' : null;
    const title = category === null ? RELATION_KIND_LABELS[kind] : category || '未分类';
    const columns = Math.min(8, Math.max(1, Math.round(Math.sqrt(group.length * 1.2))));
    const rows = Math.ceil(group.length / columns);
    const width = columns * NETWORK_NODE_WIDTH + (columns - 1) * COLUMN_GAP + GROUP_PADDING * 2;
    const height = GROUP_HEADER + rows * NETWORK_NODE_HEIGHT + (rows - 1) * ROW_GAP + GROUP_PADDING;
    return { key, title, kind, category, group, columns, width, height };
  }).sort((a, b) => Number(b.kind === 'entry') - Number(a.kind === 'entry')
    || b.group.length - a.group.length || a.title.localeCompare(b.title, 'zh-CN'));

  const area = groups.reduce((total, group) => total + (group.width + GROUP_GAP) * (group.height + GROUP_GAP), 0);
  const rowWidth = Math.max(980, Math.sqrt(area * Math.max(1.65, Math.min(3, aspectRatio))));
  const positions = new Map<RelationNode, Position>();
  let x = GROUP_PADDING;
  let y = GROUP_PADDING;
  let rowHeight = 0;
  let width = 0;
  const panels = groups.map(({ group, columns, ...panel }) => {
    if (x > GROUP_PADDING && x + panel.width > rowWidth) {
      x = GROUP_PADDING;
      y += rowHeight + GROUP_GAP;
      rowHeight = 0;
    }
    const placed = { ...panel, x, y };

    // Keep linked terms near each other within a category.
    const pending = new Set(group.sort((a, b) => (neighbors.get(b)?.length ?? 0) - (neighbors.get(a)?.length ?? 0)
      || a.title.localeCompare(b.title, 'zh-CN')));
    const ordered: RelationNode[] = [];
    for (const start of pending) {
      pending.delete(start);
      const first = ordered.length;
      ordered.push(start);
      for (let index = first; index < ordered.length; index += 1) {
        for (const neighbor of neighbors.get(ordered[index]) ?? []) {
          if (pending.delete(neighbor)) ordered.push(neighbor);
        }
      }
    }
    ordered.forEach((node, index) => positions.set(node, {
      x: x + GROUP_PADDING + (index % columns) * (NETWORK_NODE_WIDTH + COLUMN_GAP),
      y: y + GROUP_HEADER + Math.floor(index / columns) * (NETWORK_NODE_HEIGHT + ROW_GAP),
    }));

    width = Math.max(width, x + panel.width + GROUP_PADDING);
    x += panel.width + GROUP_GAP;
    rowHeight = Math.max(rowHeight, panel.height);
    return placed;
  });
  const bounds: NetworkBounds = { left: 0, top: 0, right: Math.max(width, 1), bottom: y + rowHeight + GROUP_PADDING };
  return { positions, panels, bounds };
}

export function networkLine(first: Position, second: Position): Position & { path: string; labelWidth?: number } {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const start = { x: first.x + (dx > 0 ? NETWORK_NODE_WIDTH : 0), y: first.y + NETWORK_NODE_HEIGHT / 2 };
    const end = { x: second.x + (dx > 0 ? 0 : NETWORK_NODE_WIDTH), y: second.y + NETWORK_NODE_HEIGHT / 2 };
    const x = (start.x + end.x) / 2;
    const curve = dy === 0 && Math.abs(dx) > NETWORK_NODE_WIDTH + COLUMN_GAP ? -58 : 0;
    return {
      path: `M ${start.x} ${start.y} C ${x} ${start.y + curve}, ${x} ${end.y + curve}, ${end.x} ${end.y}`,
      x, y: (start.y + end.y) / 2 + curve * 0.75,
      labelWidth: dy === 0 && !curve ? Math.min(108, Math.abs(end.x - start.x) - 4) : undefined,
    };
  }
  const start = { x: first.x + NETWORK_NODE_WIDTH / 2, y: first.y + (dy > 0 ? NETWORK_NODE_HEIGHT : 0) };
  const end = { x: second.x + NETWORK_NODE_WIDTH / 2, y: second.y + (dy > 0 ? 0 : NETWORK_NODE_HEIGHT) };
  const y = (start.y + end.y) / 2;
  const curve = dx === 0 && Math.abs(dy) > NETWORK_NODE_HEIGHT + ROW_GAP ? 108 : 0;
  return {
    path: `M ${start.x} ${start.y} C ${start.x + curve} ${y}, ${end.x + curve} ${y}, ${end.x} ${end.y}`,
    x: (start.x + end.x) / 2 + curve * 0.75, y,
  };
}

const ROUTE_CLEARANCE = 12;

function cardPorts(card: Position) {
  const middleX = card.x + NETWORK_NODE_WIDTH / 2;
  const middleY = card.y + NETWORK_NODE_HEIGHT / 2;
  const right = card.x + NETWORK_NODE_WIDTH;
  const bottom = card.y + NETWORK_NODE_HEIGHT;
  return [
    { anchor: { x: card.x, y: middleY }, outside: { x: card.x - ROUTE_CLEARANCE, y: middleY } },
    { anchor: { x: right, y: middleY }, outside: { x: right + ROUTE_CLEARANCE, y: middleY } },
    { anchor: { x: middleX, y: card.y }, outside: { x: middleX, y: card.y - ROUTE_CLEARANCE } },
    { anchor: { x: middleX, y: bottom }, outside: { x: middleX, y: bottom + ROUTE_CLEARANCE } },
  ];
}

function segmentCrossesCard(first: Position, second: Position, card: Position) {
  const left = card.x - 5;
  const right = card.x + NETWORK_NODE_WIDTH + 5;
  const top = card.y - 5;
  const bottom = card.y + NETWORK_NODE_HEIGHT + 5;
  return Math.max(first.x, second.x) > left && Math.min(first.x, second.x) < right
    && Math.max(first.y, second.y) > top && Math.min(first.y, second.y) < bottom;
}

export function selectedNetworkLine(first: Position, second: Position, { positions, bounds }: ReturnType<typeof layoutKnowledgeNetwork>): ReturnType<typeof networkLine> {
  const cards = [...positions.values()];
  const rows = [bounds.top + 14, bounds.bottom - 14, first.y - ROUTE_CLEARANCE, first.y + NETWORK_NODE_HEIGHT + ROUTE_CLEARANCE,
    second.y - ROUTE_CLEARANCE, second.y + NETWORK_NODE_HEIGHT + ROUTE_CLEARANCE];
  const columns = [bounds.left + 14, bounds.right - 14, first.x - ROUTE_CLEARANCE, first.x + NETWORK_NODE_WIDTH + ROUTE_CLEARANCE,
    second.x - ROUTE_CLEARANCE, second.x + NETWORK_NODE_WIDTH + ROUTE_CLEARANCE];
  let best: Position[] | undefined;
  let shortest = Infinity;
  for (const from of cardPorts(first)) for (const to of cardPorts(second)) {
    const start = from.outside;
    const end = to.outside;
    const candidates = [
      ...rows.map((y) => [start, { x: start.x, y }, { x: end.x, y }, end]),
      ...columns.map((x) => [start, { x, y: start.y }, { x, y: end.y }, end]),
    ];
    for (const points of candidates) {
      let length = 0;
      let blocked = false;
      for (let index = 1; index < points.length; index += 1) {
        const a = points[index - 1];
        const b = points[index];
        if (cards.some((card) => segmentCrossesCard(a, b, card))) { blocked = true; break; }
        length += Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      }
      if (!blocked && length < shortest) {
        best = [from.anchor, ...points, to.anchor];
        shortest = length;
      }
    }
  }
  if (!best) return networkLine(first, second);
  const route = best;
  const longest = route.slice(1).reduce((segment, point, index) => {
    const start = route[index];
    const length = Math.abs(start.x - point.x) + Math.abs(start.y - point.y);
    return length > segment.length ? { start, point, length } : segment;
  }, { start: route[0], point: route[1], length: 0 });
  return {
    path: route.map(({ x, y }, index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' '),
    x: (longest.start.x + longest.point.x) / 2, y: (longest.start.y + longest.point.y) / 2,
  };
}
