import type { DragEvent, ReactNode } from 'react';
import { GROWTH_DRAG_TYPE, useGrowthDragStore } from '../../store/growthDragStore';

type Side = 'before' | 'after';

function insertionAt(event: DragEvent<HTMLDivElement>, source: string, draggingGroup: boolean) {
  const { clientX: x, clientY: y, currentTarget: grid, target } = event;
  if (!(target instanceof Element)) return;
  const slots = [...grid.children].filter((slot): slot is HTMLElement => slot instanceof HTMLElement && Boolean(slot.dataset.growthTile));
  if (!slots.some((slot) => slot.dataset.growthTile === source)) return;
  const hovered = target.closest<HTMLElement>('.growth-card-slot');
  if (hovered?.parentElement === grid) {
    if (hovered.dataset.growthTile === source) return;
    const { left, right, top, bottom } = hovered.getBoundingClientRect();
    if (x - left <= 24 || y - top <= 18) return { slot: hovered, side: 'before' as const };
    if (right - x <= 24 || bottom - y <= 18) return { slot: hovered, side: 'after' as const };
    if (draggingGroup) return { slot: hovered, side: x < (left + right) / 2 ? 'before' as const : 'after' as const };
    return;
  }

  const others = slots.filter((slot) => slot.dataset.growthTile !== source).map((slot) => ({ slot, box: slot.getBoundingClientRect() }));
  const row = others.filter(({ box }) => box.top <= y && y <= box.bottom);
  const next = row.length ? row.find(({ box }) => x < box.left) : others.find(({ box }) => y < box.top);
  if (next) return { slot: next.slot, side: 'before' as const };
  const last = (row.length ? row : others).at(-1);
  if (last) return { slot: last.slot, side: 'after' as const };
}

function clearInsertion(grid: HTMLElement) {
  grid.querySelector('[data-insertion-side]')?.removeAttribute('data-insertion-side');
}

export default function GrowthCardGrid({ pending, canReorder, onReorder, children }: {
  pending?: boolean;
  canReorder: boolean;
  onReorder: (source: string, anchor: string, side: Side) => void;
  children: ReactNode;
}) {
  const handleInsertion = (event: DragEvent<HTMLDivElement>) => {
    const grid = event.currentTarget;
    clearInsertion(grid);
    if (!canReorder || !event.dataTransfer.types.includes(GROWTH_DRAG_TYPE)) return;
    const drag = useGrowthDragStore.getState().drag;
    if (!drag || 'exercise' in drag) return;
    const source = 'groupId' in drag ? `group:${drag.groupId}` : `card:${drag.cardId}`;
    const insertion = insertionAt(event, source, 'groupId' in drag);
    if (!insertion) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    return { ...insertion, source };
  };

  return <div className={pending ? 'growth-card-grid growth-pending-grid' : 'growth-card-grid'}
    onDragOverCapture={(event) => {
      const insertion = handleInsertion(event);
      if (insertion) {
        insertion.slot.querySelector('[data-drop-intent]')?.removeAttribute('data-drop-intent');
        insertion.slot.dataset.insertionSide = insertion.side;
      }
    }}
    onDragLeave={(event) => {
      if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) clearInsertion(event.currentTarget);
    }}
    onDropCapture={(event) => {
      const insertion = handleInsertion(event);
      if (!insertion?.slot.dataset.growthTile) return;
      const grid = event.currentTarget;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const positions = reduceMotion ? [] : [...grid.querySelectorAll<HTMLElement>('.growth-card-slot')]
        .filter((slot) => slot.dataset.growthTile !== insertion.source)
        .map((slot) => ({ slot, before: slot.getBoundingClientRect() }));
      onReorder(insertion.source, insertion.slot.dataset.growthTile, insertion.side);
      useGrowthDragStore.setState({ drag: undefined });
      if (positions.length) requestAnimationFrame(() => {
        for (const { slot, before } of positions) {
          if (!slot.isConnected) continue;
          const after = slot.getBoundingClientRect();
          const x = before.left - after.left;
          const y = before.top - after.top;
          if (x || y) slot.animate([{ translate: `${x}px ${y}px` }, { translate: 'none' }], {
            duration: 170, easing: 'cubic-bezier(.2,.75,.3,1)',
          });
        }
      });
    }}>
    {children}
  </div>;
}
