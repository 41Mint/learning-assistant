import { useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useCurrentGoalStore } from '../../store/currentGoalStore';
import type { ChatGrowthCard } from '../../types/assistantChat';
import { AssistantSlots } from '../Assistant/assistantSlots';

export interface GrowthCardAction {
  label: string;
  run?: (trigger: HTMLButtonElement) => void;
}

export default function GrowthCard({ id, card, recordLabel, onRecord, actions, children, href, highlighted }: {
  id: string;
  card: ChatGrowthCard;
  recordLabel: string;
  onRecord?: (trigger: HTMLButtonElement) => void;
  actions?: GrowthCardAction[];
  children: ReactNode;
  href?: string;
  highlighted?: boolean;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const { askAboutGrowthCard } = useContext(AssistantSlots);
  const goal = useCurrentGoalStore((state) => state.goal);
  const setGoal = useCurrentGoalStore((state) => state.setCurrentGoal);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const current = goal?.type === 'growth-card' && goal.id === id;
  useEffect(() => {
    if (!highlighted || !trigger.current?.getClientRects().length) return;
    trigger.current.focus({ preventScroll: true });
    trigger.current.scrollIntoView({ block: 'center' });
  }, [highlighted]);

  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = () => menu.current?.hidePopover();
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('hashchange', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('hashchange', dismiss);
    };
  }, [menuOpen]);

  const showMenu = (x: number, y: number, keyboard: boolean) => {
    const element = menu.current;
    if (!element) return;
    if (!element.matches(':popover-open')) element.showPopover({ source: trigger.current ?? undefined });
    const { width, height } = element.getBoundingClientRect();
    element.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`;
    element.style.top = `${Math.max(8, Math.min(y, window.innerHeight - height - 8))}px`;
    if (keyboard) element.querySelector('button')?.focus({ preventScroll: true });
  };
  const act = (action: (button: HTMLButtonElement) => void) => {
    menu.current?.hidePopover();
    if (!trigger.current) return;
    trigger.current.focus({ preventScroll: true });
    action(trigger.current);
  };

  return <article className="growth-card growth-summary" aria-label={card.title} data-card-focus={highlighted || undefined} onContextMenu={(event) => {
    if (event.shiftKey && event.button === 2) return;
    event.preventDefault();
    const box = trigger.current?.getBoundingClientRect();
    showMenu(event.clientX || box?.left || 0, event.clientY || box?.bottom || 0, event.button !== 2);
  }}>
    <div className="growth-card-heading">
      <h3>{href ? <a href={href}>{card.title}</a> : card.title}</h3>
      <button ref={trigger} type="button" className="growth-card-menu-button" aria-label="卡片操作" title="卡片操作" aria-expanded={menuOpen}
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          if (menu.current?.matches(':popover-open')) menu.current.hidePopover();
          else showMenu(box.left, box.bottom + 4, event.detail === 0);
        }}>⋯</button>
    </div>
    <div className="growth-card-meta">
      {card.domains.map((domain) => <span key={domain} className="growth-domain" data-domain={domain}>{domain}</span>)}
      {current && <small className="growth-current">当前目标</small>}
    </div>
    {children}
    {error && <small className="growth-muted" role="alert">{error}</small>}
    <div ref={menu} popover="auto" className="workspace-context-menu growth-card-menu" role="group" aria-label="卡片操作"
      onToggle={(event) => setMenuOpen(event.currentTarget.matches(':popover-open'))}>
      <div className="workspace-context-menu-title" aria-hidden="true">{card.title}</div>
      <button type="button" disabled={!onRecord} onClick={() => act((button) => onRecord?.(button))}>{recordLabel}</button>
      {actions?.map(({ label, run }) => <button type="button" key={label} disabled={!run} onClick={() => { if (run) act(run); }}>{label}</button>)}
      <button type="button" disabled={current} onClick={() => act(() => {
        if (goal && !window.confirm(`将当前目标「${goal.label}」换成「${card.title}」？`)) return;
        try {
          setGoal({ type: 'growth-card', id, label: card.title });
          setError('');
        } catch {
          setError('学习目标保存失败，请重试。');
        }
      })}>{current ? '已设为学习目标' : '设为学习目标'}</button>
      <button type="button" onClick={() => act(() => askAboutGrowthCard({ id, ...card, title: card.title.slice(0, 100), description: card.description.slice(0, 1200) }))}>询问智能体</button>
    </div>
  </article>;
}
