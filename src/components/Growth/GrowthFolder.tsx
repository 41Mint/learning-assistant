import { useLayoutEffect, useRef, useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import useGrowthBoxSelection from './useGrowthBoxSelection';

function transformToOrigin(origin: DOMRect | undefined, box: DOMRect) {
  if (!origin) return 'scale(.98)';
  const x = origin.left + origin.width / 2 - box.left - box.width / 2;
  const y = origin.top + origin.height / 2 - box.top - box.height / 2;
  return `translate(${x}px, ${y}px) scale(${Math.min(1, origin.width / box.width)}, ${Math.min(1, origin.height / box.height)})`;
}

export default function GrowthFolder({ name, description, origin, children, historyTools, onClose, onManage, onSelectCards, onDragOutside, onDropOutside }: {
  name: string;
  description?: string;
  origin?: DOMRect;
  children: ReactNode;
  historyTools: ReactNode;
  onClose: () => void;
  onManage: () => void;
  onSelectCards: (ids: string[], extend: boolean) => void;
  onDragOutside: (event: DragEvent<HTMLDialogElement>) => boolean;
  onDropOutside: (event: DragEvent<HTMLDialogElement>) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const motion = useRef<Animation>(undefined);
  const [outside, setOutside] = useState(false);
  const boxSelection = useGrowthBoxSelection(true, onSelectCards);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    heading.current?.focus({ preventScroll: true });
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      motion.current = dialog.animate([
        { transform: transformToOrigin(origin, dialog.getBoundingClientRect()), opacity: 0.45 },
        { transform: 'none', opacity: 1 },
      ], { duration: 220, easing: 'cubic-bezier(.2,.7,.25,1)' });
    }
    return () => { motion.current?.cancel(); dialog.close(); };
  }, [origin]);
  const closeFolder = () => {
    const dialog = ref.current;
    if (!dialog || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose();
      return;
    }
    if (dialog.dataset.closing) return;
    const { transform, opacity } = getComputedStyle(dialog);
    motion.current?.cancel();
    dialog.dataset.closing = 'true';
    motion.current = dialog.animate([
      { transform, opacity },
      { transform: transformToOrigin(origin, dialog.getBoundingClientRect()), opacity: 0 },
    ], { duration: 220, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'forwards' });
    motion.current.onfinish = onClose;
  };
  return <dialog ref={ref} className="growth-folder" aria-label={name} data-drop-outside={outside || undefined}
    onCancel={(event) => {
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      closeFolder();
    }}
    onClick={(event) => { if (event.target === event.currentTarget) closeFolder(); }}
    onDragEnd={() => setOutside(false)}
    onDragLeave={(event) => { if (event.target === event.currentTarget) setOutside(false); }}
    onDragOverCapture={(event) => setOutside(event.target === event.currentTarget && onDragOutside(event))}
    onDrop={(event) => {
      setOutside(false);
      if (event.target === event.currentTarget) onDropOutside(event);
    }}>
    <div className="growth-folder-content" {...boxSelection.handlers}>
      <header>
        <h2 ref={heading} tabIndex={-1}>{name}</h2>
        {historyTools}
        <button type="button" className="growth-board-group-button" onClick={onManage}>管理卡组</button>
        <button type="button" className="growth-board-group-button" aria-label="关闭卡组" onClick={closeFolder}>×</button>
      </header>
      {description && <p className="growth-muted growth-note">{description}</p>}
      {children}
      {boxSelection.rectangle}
    </div>
  </dialog>;
}
