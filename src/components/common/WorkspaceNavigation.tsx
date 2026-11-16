import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { GrowthView } from '../../store/workspaceStore';
import ResourceSearch from '../Search/ResourceSearch';

const items = [
  { id: 'today', label: '今日学习', icon: 'M3 10 12 3l9 7v10h-6v-6H9v6H3Z' },
  { id: 'path', label: '成长记录', icon: 'm2 9 10-5 10 5-10 5-10-5Zm4 2v5c3 3 9 3 12 0v-5m4-2v6' },
  { id: 'history', label: '历史回顾', icon: 'M4 11a8 8 0 1 1 2 6m-3-9v4h4m5-5v5l3 2' },
  { id: 'knowledge', label: '知识词条', icon: 'M5 4h14v16H5a2 2 0 0 1 0-4h14M5 4a2 2 0 0 0-2 2v12m5-10h7m-7 4h5' },
  { id: 'network', label: '知识网络', icon: 'M8 7h8M7 9l4 7m6-7-4 7M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm-6 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z' },
  { id: 'data', label: '数据管理', icon: 'M4 6c0-4 16-4 16 0v12c0 4-16 4-16 0Zm0 0c0 4 16 4 16 0M4 12c0 4 16 4 16 0' },
] as const;

function NavIcon({ path }: { path: string }) {
  return <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
}

export default function WorkspaceNavigation({ activePage, activeLabel, growthView }: {
  activePage: string;
  activeLabel: string;
  growthView: GrowthView;
}) {
  const [drawer, setDrawer] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const drawerClose = useRef<HTMLButtonElement>(null);
  const inGrowth = activePage === 'path' || activePage === 'code';

  useEffect(() => {
    if (!drawer) return;
    drawerClose.current?.focus({ preventScroll: true });
    const media = window.matchMedia('(min-width: 721px) and (any-hover: hover)');
    const resize = () => { if (media.matches) setDrawer(false); };
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, [drawer]);

  const closeDrawer = () => {
    setDrawer(false);
    if (drawer) mobileTrigger.current?.focus({ preventScroll: true });
  };
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (event.detail > 0) setDismissed(true);
    closeDrawer();
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  return <nav className="app-navigation" aria-label="主要功能" data-open={drawer || undefined} data-dismissed={dismissed || undefined}
    onMouseLeave={() => setDismissed(false)}
    onKeyDown={(event) => {
      if (!drawer || event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      closeDrawer();
    }}>
    <button ref={mobileTrigger} type="button" className="app-navigation-toggle" aria-label="页面菜单"
      aria-expanded={drawer} aria-controls="app-navigation-links" onClick={() => setDrawer(!drawer)}>
      <NavIcon path="M4 6h16M4 12h16M4 18h16" /><span>{activeLabel}</span>
    </button>
    <button className="app-navigation-backdrop" type="button" tabIndex={-1} aria-hidden={!drawer} aria-label="关闭页面菜单" onClick={closeDrawer} />
    <div className="app-navigation-links" id="app-navigation-links">
      <div className="app-navigation-heading">
        <button ref={drawerClose} type="button" className="app-drawer-close" aria-label="收起导航" onClick={closeDrawer}><NavIcon path="m6 6 12 12M18 6 6 18" /></button>
      </div>
      {items.map(({ id, label, icon }) => <div key={id} className="app-nav-group">
        <a href={`#${id}`} className="app-nav-item" aria-label={label}
          aria-current={activePage === id && (id !== 'path' || growthView !== 'topics') ? 'page' : undefined}
          data-active={id === 'path' && inGrowth || undefined} onClick={follow}>
          <NavIcon path={icon} /><span className="app-nav-label">{label}</span>
        </a>
        {id === 'path' && <div className="app-growth-links" role="group" aria-label="成长记录子页">
          <a href="#path/topics" aria-label="参考路径与任务" aria-current={activePage === 'path' && growthView === 'topics' ? 'page' : undefined} onClick={follow}>
            <NavIcon path="M6 6h12M6 12h12M6 18h12M3 6h.01M3 12h.01M3 18h.01" /><span className="app-nav-label">参考路径与任务</span>
          </a>
          <a href="#code" aria-label="项目代码" aria-current={activePage === 'code' ? 'page' : undefined} onClick={follow}>
            <NavIcon path="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16" /><span className="app-nav-label">项目代码</span>
          </a>
        </div>}
      </div>)}
    </div>
    <div className="app-navigation-search" onClick={closeDrawer}>
      <ResourceSearch triggerContent={<><NavIcon path="M16 16l4 4M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /><span className="app-nav-label">检索</span></>} />
    </div>
  </nav>;
}
