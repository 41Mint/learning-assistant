import { useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';

function bounds(x: number, y: number, endX: number, endY: number) {
  return { left: Math.min(x, endX), top: Math.min(y, endY), right: Math.max(x, endX), bottom: Math.max(y, endY) };
}

export default function useGrowthBoxSelection(enabled: boolean, onSelect: (ids: string[], extend: boolean) => void) {
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean; extend: boolean }>(undefined);
  const [box, setBox] = useState<ReturnType<typeof bounds>>();
  const suppressClick = useRef(false);
  const reset = () => { drag.current = undefined; setBox(undefined); };

  const handlers = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      suppressClick.current = false;
      if (!enabled || event.button !== 0 || event.pointerType !== 'mouse' || !event.isPrimary ||
        !(event.target instanceof Element) ||
        event.target.closest('.growth-card-slot, article, button, a, input, textarea, select, label, .growth-board-toolbar, .growth-selection, .growth-folder-content > header, .growth-folder-tools')) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, extend: event.shiftKey };
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const current = drag.current;
      if (!current || current.id !== event.pointerId) return;
      if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 5) return;
      current.moved = true;
      setBox(bounds(current.x, current.y, event.clientX, event.clientY));
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const current = drag.current;
      if (!current || current.id !== event.pointerId) return;
      reset();
      if (!current.moved) return;
      suppressClick.current = true;
      const area = bounds(current.x, current.y, event.clientX, event.clientY);
      const ids = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-growth-card]')].flatMap((card) => {
        const rect = card.getBoundingClientRect();
        return rect.width && rect.height && rect.left < area.right && rect.right > area.left &&
          rect.top < area.bottom && rect.bottom > area.top && card.dataset.growthCard ? [card.dataset.growthCard] : [];
      });
      onSelect(ids, current.extend);
    },
    onPointerCancel: reset,
    onLostPointerCapture: reset,
    onClickCapture: (event: MouseEvent<HTMLElement>) => {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      event.stopPropagation();
    },
  };
  return { handlers, rectangle: box && <div className="growth-selection-box" aria-hidden="true"
    style={{ left: box.left, top: box.top, width: box.right - box.left, height: box.bottom - box.top }} /> };
}
