import { useEffect, useRef, useState } from 'react';
import { workspaceResourceTarget } from '../../store/workspaceStore';
import type { RelationEdge, RelationNode } from '../../utils/relations';
import { relationLabel, RELATION_KIND_LABELS } from '../../utils/relations';

const CARD_HEIGHT = 72;
const ROW_HEIGHT = 94;

interface CardPosition {
  x: number;
  y: number;
  width: number;
}

function layoutGraph(width: number, count: number) {
  if (width < 540) {
    const center = { x: 12, y: 16, width: width - 24 };
    const trunkX = 24;
    const nodeX = 100;
    const leaves = Array.from({ length: count }, (_, index) => {
      const y = 112 + index * ROW_HEIGHT;
      const midY = y + CARD_HEIGHT / 2;
      return { x: nodeX, y, width: width - nodeX - 12, midY, labelX: 63, labelWidth: 66, path: `M ${trunkX} ${midY} H ${nodeX}` };
    });
    return {
      center, leaves, height: count ? leaves[count - 1].y + CARD_HEIGHT + 16 : 106,
      trunk: count ? `M ${trunkX} ${center.y + CARD_HEIGHT} V ${leaves[count - 1].midY}` : '',
    };
  }

  const height = Math.max(220, count * ROW_HEIGHT + 22);
  const cardWidth = Math.min(252, Math.round(width * 0.34));
  const center = { x: 22, y: (height - CARD_HEIGHT) / 2, width: cardWidth };
  const startX = center.x + cardWidth;
  const endX = width - cardWidth - 22;
  const labelWidth = Math.min(112, Math.round((endX - startX) * 0.65));
  const labelX = endX - labelWidth / 2 - 10;
  const elbowX = labelX - labelWidth / 2 - 7;
  const bendX = (startX + elbowX) / 2;
  const leaves = Array.from({ length: count }, (_, index) => {
    const y = center.y + (index - (count - 1) / 2) * ROW_HEIGHT;
    const midY = y + CARD_HEIGHT / 2;
    return {
      x: endX, y, width: cardWidth, midY, labelX, labelWidth,
      path: `M ${startX} ${height / 2} C ${bendX} ${height / 2}, ${bendX} ${midY}, ${elbowX} ${midY} H ${endX}`,
    };
  });
  return { center, leaves, height, trunk: '' };
}

function NodeCard({ node, position, center, selected }: { node: RelationNode; position: CardPosition; center?: boolean; selected?: boolean }) {
  const title = [RELATION_KIND_LABELS[node.kind], node.title, node.detail].filter(Boolean).join(' · ');
  const attributes = workspaceResourceTarget(node.href);
  return (
    <a href={node.href} {...attributes} title={title} aria-label={'打开' + title + (attributes.target ? '（新标签页）' : '')}
      className="relation-node" data-kind={node.kind} data-center={center || undefined} data-selected={selected || undefined}
      style={{ left: position.x, top: position.y, width: position.width, height: CARD_HEIGHT }}>
      <span className="relation-node-kind">{center ? '当前资料 · ' : ''}{RELATION_KIND_LABELS[node.kind]}</span>
      <strong>{node.title}</strong>
      {node.detail && <small>{node.detail}</small>}
    </a>
  );
}

export default function RelationGraph({ center, edges, selected, select }: {
  center: RelationNode;
  edges: RelationEdge[];
  selected: string | null;
  select: (key: string) => void;
}) {
  const map = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  useEffect(() => {
    const element = map.current;
    if (!element) return;
    const resize = () => { if (element.clientWidth) setWidth(element.clientWidth); };
    const observer = new ResizeObserver(resize);
    resize();
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const layout = layoutGraph(width, edges.length);

  return (
    <div ref={map} className="relation-map" style={{ height: layout.height }} role="group" aria-label="直接关系图">
      <svg className="relation-lines" viewBox={`0 0 ${width} ${layout.height}`} preserveAspectRatio="none" aria-hidden="true">
        {layout.trunk && <path d={layout.trunk} />}
        {edges.map((edge, index) => (
          <g key={edge.key}>
            <path d={layout.leaves[index].path} data-selected={selected === edge.key || undefined} />
            <path className="relation-line-hit" d={layout.leaves[index].path} onClick={() => select(edge.key)} />
          </g>
        ))}
      </svg>
      <NodeCard node={center} position={layout.center} center />
      {edges.map((edge, index) => {
        const leaf = layout.leaves[index];
        const label = relationLabel(edge);
        return (
          <div key={edge.key}>
            <button type="button" className="relation-edge" title={label} aria-label={`查看连线 ${label} · ${edge.node.title}`}
              aria-pressed={selected === edge.key} aria-controls="relation-details"
              style={{ left: leaf.labelX, top: leaf.midY, maxWidth: leaf.labelWidth }} onClick={() => select(edge.key)}>{label}</button>
            <NodeCard node={edge.node} position={leaf} selected={selected === edge.key} />
          </div>
        );
      })}
    </div>
  );
}
