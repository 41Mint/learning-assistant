import { useEffect, useRef } from 'react';
import type { DragEventHandler, MouseEventHandler } from 'react';
import type { GrowthDomain, GrowthGroup } from '../../types';
import { GROWTH_DRAG_TYPE, useGrowthDragStore } from '../../store/growthDragStore';
import { growthBoardHref } from '../../store/workspaceStore';
import { startCardDragMotion } from './cardDragMotion';

export default function GrowthGroupStack({ group, count, domains, canDrag, menuOpen, onDragOver, onDrop, onOpen, onMenu }: {
  group: GrowthGroup;
  count: number;
  domains: GrowthDomain[];
  canDrag: boolean;
  menuOpen: boolean;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  onOpen: MouseEventHandler<HTMLAnchorElement>;
  onMenu: MouseEventHandler<HTMLElement>;
}) {
  const stopMotion = useRef<() => void>(undefined);
  useEffect(() => () => stopMotion.current?.(), []);

  return <div className="growth-card-slot" data-growth-tile={`group:${group.id}`}>
    <div className="growth-group-stack" data-layers={Math.min(2, Math.max(1, count - 1))}
      draggable={canDrag} onDragOver={onDragOver} onDrop={onDrop}
      onContextMenu={(event) => { if (!(event.shiftKey && event.button === 2)) onMenu(event); }}
      onDragStart={(event) => {
        if (!canDrag || (event.target instanceof Element && event.target.closest('button'))) {
          event.preventDefault();
          return;
        }
        stopMotion.current?.();
        event.dataTransfer.setData(GROWTH_DRAG_TYPE, '');
        event.dataTransfer.effectAllowed = 'move';
        useGrowthDragStore.setState({ drag: { groupId: group.id } });
        stopMotion.current = startCardDragMotion(event.currentTarget, event, event.dataTransfer);
      }}>
      <a href={growthBoardHref('all', group.id)} className="growth-stack-open" draggable={false}
        aria-label={`打开卡组 ${group.name}，${count} 张卡片`} aria-haspopup="dialog" onClick={onOpen}>
        <div className="growth-stack-header">
          <strong>{group.name}</strong>
          <small>{count} 张</small>
        </div>
        <div className="growth-card-meta">{domains.map((domain) => <span key={domain} className="growth-domain" data-domain={domain}>{domain}</span>)}</div>
        {group.description && <p className="growth-card-summary">{group.description}</p>}
      </a>
      <button type="button" className="growth-card-menu-button growth-stack-menu"
        aria-label={`卡组操作 · ${group.name}`} aria-haspopup="true" aria-expanded={menuOpen} onClick={onMenu}>⋯</button>
    </div>
  </div>;
}
