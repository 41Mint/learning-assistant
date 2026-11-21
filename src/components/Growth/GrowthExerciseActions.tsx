import { useEffect, useId, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { ADD_EXERCISE_LABEL } from '../../utils/growthLabels';

export default function GrowthExerciseActions({ disabled, side = false, triggerRef, onWrite, onRecommend }: {
  disabled: boolean;
  side?: boolean;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  onWrite: (trigger: HTMLButtonElement) => void;
  onRecommend: () => void;
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const trigger = triggerRef ?? button;
  const menu = useRef<HTMLDivElement>(null);
  const hover = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const dismiss = () => menu.current?.hidePopover();
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [open]);

  const show = (fromHover: boolean) => {
    const panel = menu.current;
    const anchor = trigger.current;
    if (disabled || !panel || !anchor || panel.matches(':popover-open')) return;
    const box = anchor.getBoundingClientRect();
    const boundary = anchor.closest('.growth-folder-controls')?.getBoundingClientRect().right ?? window.innerWidth - 8;
    panel.dataset.side = side ? 'right' : 'below';
    panel.showPopover({ source: anchor });
    const right = side && box.right + panel.offsetWidth <= boundary;
    panel.dataset.side = right ? 'right' : 'below';
    if (fromHover && !right) {
      panel.hidePopover();
      return;
    }
    hover.current = fromHover;
    const left = right ? box.right : box.right - panel.offsetWidth;
    const top = right ? box.top : box.bottom + 6;
    panel.style.left = `${Math.max(8, Math.min(left, window.innerWidth - panel.offsetWidth - 8))}px`;
    panel.style.top = `${Math.max(8, Math.min(top, window.innerHeight - panel.offsetHeight - 8))}px`;
  };

  const choose = (action: (anchor: HTMLButtonElement) => void) => {
    menu.current?.hidePopover();
    const anchor = trigger.current;
    if (!anchor) return;
    anchor.focus({ preventScroll: true });
    action(anchor);
  };

  return <div className={side ? 'growth-folder-add-exercise' : 'growth-board-primary'}
    onPointerEnter={(event) => { if (side && event.pointerType === 'mouse') show(true); }}
    onPointerLeave={(event) => {
      if (event.pointerType === 'mouse' && hover.current && !menu.current?.contains(document.activeElement)) menu.current?.hidePopover();
    }}>
    <button ref={trigger} type="button" className={side ? 'growth-board-group-button' : 'note-button'}
      aria-expanded={open} aria-controls={id} disabled={disabled} onClick={() => {
        if (menu.current?.matches(':popover-open') && !hover.current) {
          menu.current.hidePopover();
          return;
        }
        show(false);
        hover.current = false;
        menu.current?.querySelector('button')?.focus({ preventScroll: true });
      }}>{ADD_EXERCISE_LABEL}{side && <span aria-hidden="true"> ›</span>}</button>
    <div ref={menu} id={id} popover="auto" role="group" aria-label="添加练习方式"
      className="workspace-context-menu growth-add-exercise" onToggle={(event) => {
        const shown = event.currentTarget.matches(':popover-open');
        if (!shown) hover.current = false;
        setOpen(shown);
      }}>
      <button type="button" onClick={() => choose(onWrite)}>自己填写</button>
      <button type="button" onClick={() => choose(onRecommend)}>让智能体推荐</button>
    </div>
  </div>;
}
