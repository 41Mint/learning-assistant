import { useLayoutEffect, useRef, useState } from 'react';
import type { DragEvent, ReactNode } from 'react';

export default function GrowthFolder({ name, origin, children, onClose, onManage, onDragOutside, onDropOutside }: {
  name: string;
  origin: DOMRect;
  children: ReactNode;
  onClose: () => void;
  onManage: () => void;
  onDragOutside: (event: DragEvent<HTMLDialogElement>) => boolean;
  onDropOutside: (event: DragEvent<HTMLDialogElement>) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [outside, setOutside] = useState(false);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    const box = dialog.getBoundingClientRect();
    const x = origin.left + origin.width / 2 - box.left - box.width / 2;
    const y = origin.top + origin.height / 2 - box.top - box.height / 2;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dialog.animate([
        { transform: `translate(${x}px, ${y}px) scale(${Math.min(1, origin.width / box.width)}, ${Math.min(1, origin.height / box.height)})`, opacity: 0.45 },
        { transform: 'none', opacity: 1 },
      ], { duration: 180, easing: 'ease-out' });
    }
    return () => dialog.close();
  }, [origin]);
  return <dialog ref={ref} className="growth-folder" aria-label={name} data-drop-outside={outside || undefined}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    onDragEnd={() => setOutside(false)}
    onDragLeave={(event) => { if (event.target === event.currentTarget) setOutside(false); }}
    onDragOverCapture={(event) => setOutside(event.target === event.currentTarget && onDragOutside(event))}
    onDrop={(event) => {
      setOutside(false);
      if (event.target === event.currentTarget) onDropOutside(event);
    }}>
    <div className="growth-folder-content">
      <header>
        <h2>{name}</h2>
        <button type="button" className="growth-board-group-button" onClick={onManage}>管理卡组</button>
        <button type="button" className="growth-board-group-button" aria-label="关闭卡组" onClick={onClose}>×</button>
      </header>
      {children}
    </div>
  </dialog>;
}
