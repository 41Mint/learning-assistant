import type { DragEventHandler, MouseEventHandler } from 'react';
import type { GrowthGroup } from '../../types';
import { growthBoardHref } from '../../store/workspaceStore';

export default function GrowthGroupStack({ group, cards, onDragOver, onDrop, onOpen, onContextMenu }: {
  group: GrowthGroup;
  cards: { id: string; complete: boolean }[];
  onDragOver: DragEventHandler<HTMLAnchorElement>;
  onDrop: DragEventHandler<HTMLAnchorElement>;
  onOpen: MouseEventHandler<HTMLAnchorElement>;
  onContextMenu: MouseEventHandler<HTMLAnchorElement>;
}) {
  return <a href={growthBoardHref('all', group.id)} className="growth-group-stack" draggable={false}
    aria-label={`打开卡组 ${group.name}，${cards.length} 张卡片`} aria-haspopup="dialog"
    onDragOver={onDragOver} onDrop={onDrop} onClick={onOpen} onContextMenu={onContextMenu}>
    <div className="growth-stack-header">
      <strong>{group.name}</strong>
      <small>{cards.length} 张</small>
    </div>
    {cards.length > 0 ? <ul aria-hidden="true">{cards.slice(0, 6).map(({ id, complete }) => (
      <li key={id} data-complete={complete || undefined} />
    ))}</ul> : <span className="growth-muted">空卡组</span>}
  </a>;
}
