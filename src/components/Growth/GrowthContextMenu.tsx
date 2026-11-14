import { useLayoutEffect, useRef } from 'react';

export interface GrowthMenu {
  x: number;
  y: number;
  title: string;
  actions: { label: string; run: () => void; danger?: boolean }[];
  trigger?: HTMLElement;
  keyboard?: boolean;
}

export default function GrowthContextMenu({ menu, onClose }: { menu: GrowthMenu; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.showPopover({ source: menu.trigger });
    element.style.left = `${Math.max(8, Math.min(menu.x, window.innerWidth - element.offsetWidth - 8))}px`;
    element.style.top = `${Math.max(8, Math.min(menu.y, window.innerHeight - element.offsetHeight - 8))}px`;
    if (menu.keyboard) element.querySelector('button')?.focus({ preventScroll: true });
    const dismiss = () => element.hidePopover();
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('hashchange', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('hashchange', dismiss);
    };
  }, [menu]);

  return <div ref={ref} popover="auto" className="workspace-context-menu growth-card-menu" role="group" aria-label={menu.title}
    onToggle={(event) => { if (!event.currentTarget.matches(':popover-open')) onClose(); }}>
    <div className="workspace-context-menu-title" aria-hidden="true">{menu.title}</div>
    {menu.actions.map(({ label, run, danger }) => <button key={label} type="button" data-danger={danger || undefined} onClick={() => {
      ref.current?.hidePopover();
      onClose();
      run();
    }}>{label}</button>)}
  </div>;
}
