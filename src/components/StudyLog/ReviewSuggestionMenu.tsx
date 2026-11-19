import { useLayoutEffect, useRef } from 'react';

export interface ReviewMenuAnchor {
  id: number;
  x: number;
  y: number;
  trigger: HTMLElement;
}

export default function ReviewSuggestionMenu({ anchor, title, canSave, onClose, onSave, onQuote }: {
  anchor: ReviewMenuAnchor;
  title: string;
  canSave: boolean;
  onClose: () => void;
  onSave: () => void;
  onQuote: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.showPopover({ source: anchor.trigger });
    element.style.left = `${Math.max(8, Math.min(anchor.x, window.innerWidth - element.offsetWidth - 8))}px`;
    element.style.top = `${Math.max(8, Math.min(anchor.y, window.innerHeight - element.offsetHeight - 8))}px`;
    element.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    const dismiss = () => element.hidePopover();
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('hashchange', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('hashchange', dismiss);
    };
  }, [anchor]);

  const close = (restoreFocus: boolean) => {
    ref.current?.hidePopover();
    onClose();
    if (restoreFocus) anchor.trigger.focus({ preventScroll: true });
  };

  return <div ref={ref} popover="auto" className="workspace-context-menu review-suggestion-menu" role="menu" aria-label="建议操作"
    onToggle={(event) => { if (!event.currentTarget.matches(':popover-open')) onClose(); }}
    onKeyDown={(event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
          : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus({ preventScroll: true });
      }
    }}>
    <div className="workspace-context-menu-title" aria-hidden="true">{title}</div>
    {canSave && <button type="button" role="menuitem" onClick={() => { close(true); onSave(); }}>保存这条建议</button>}
    <button type="button" role="menuitem" onClick={() => { close(false); onQuote(); }}>引用这条建议继续询问</button>
  </div>;
}
