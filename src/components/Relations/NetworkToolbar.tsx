import { useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import type { NetworkLayers } from '../../utils/knowledgeNetwork';
import { relationNodeKey, RELATION_KIND_LABELS } from '../../utils/relations';
import type { RelationNode } from '../../utils/relations';
import type { HistoryDirection } from './useNetworkHistory';

const icons = {
  search: 'M15.5 15.5 21 21M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z',
  layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5',
  link: 'M6.5 17.5l11-11M7 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM21 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  add: 'M12 5v14M5 12h14',
  expand: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  collapse: 'M4 9h5V4M15 4v5h5M20 15h-5v5M9 20v-5H4',
  undo: 'M9 5 4 10l5 5M4 10h10a5 5 0 0 1 0 10h-3',
  redo: 'm15 5 5 5-5 5M20 10H10a5 5 0 0 0 0 10h3',
  reset: 'M4 10a8 8 0 1 1 1.5 7.5M4 4v6h6',
};

export function NetworkToolButton({ icon, label, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: keyof typeof icons;
  label: string;
}) {
  return <button type="button" className="network-icon-button" aria-label={label} title={label} {...props}>
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[icon]} /></svg>
  </button>;
}

interface Props {
  query: string;
  results: RelationNode[];
  onQuery: (query: string) => void;
  onLocate: (node: RelationNode) => void;
  layers: NetworkLayers;
  categories: string[];
  visibleModules: string[];
  crossOnly: boolean;
  hops: number;
  canFocus: boolean;
  onToggleLayer: (layer: keyof NetworkLayers) => void;
  onModules: (modules: string[] | null) => void;
  onCrossOnly: (checked: boolean) => void;
  onHops: (hops: number) => void;
  linkStep?: string;
  linkDisabled: boolean;
  onToggleLink: () => void;
  onNewEntry: () => void;
  historyAvailable: Record<HistoryDirection, boolean>;
  onHistory: (direction: HistoryDirection) => void;
  fullscreen: boolean;
  onFullscreen: () => void;
}

export default function NetworkToolbar({ query, results, onQuery, onLocate, layers, categories, visibleModules, crossOnly, hops, canFocus,
  onToggleLayer, onModules, onCrossOnly, onHops, linkStep, linkDisabled, onToggleLink, onNewEntry,
  historyAvailable, onHistory, fullscreen, onFullscreen }: Props) {
  const [panel, setPanel] = useState<'search' | 'filters' | null>(null);
  const tools = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const allModulesVisible = visibleModules.length === categories.length;
  const moduleStatus = allModulesVisible ? '' : visibleModules.length === 1 ? visibleModules[0] || '未分类' : `${visibleModules.length} 个模块`;
  const filterStatus = [moduleStatus, crossOnly ? '仅跨模块关联' : '', hops > 0 ? `${hops} 跳` : ''].filter(Boolean).join(' · ');
  const closePanel = () => {
    if (panel === 'search') onQuery('');
    setPanel(null);
  };
  const choose = (node: RelationNode) => {
    onLocate(node);
    trigger.current?.focus();
    closePanel();
  };

  useEffect(() => {
    if (!panel) return;
    if (panel === 'search') search.current?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || tools.current?.contains(event.target)) return;
      if (panel === 'search') onQuery('');
      setPanel(null);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [panel, onQuery]);

  return <div ref={tools} className="network-tools" role="group" aria-label="画布工具" onKeyDown={(event) => {
    if (!panel || event.key !== 'Escape' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    trigger.current?.focus();
    closePanel();
  }}>
    <NetworkToolButton icon="search" label="搜索节点" aria-expanded={panel === 'search'} aria-controls="network-node-search"
      onClick={(event) => {
        trigger.current = event.currentTarget;
        if (panel === 'search') closePanel();
        else setPanel('search');
      }} />
    <NetworkToolButton icon="layers" label="图层与筛选" aria-expanded={panel === 'filters'} aria-controls="network-filters"
      disabled={Boolean(linkStep)} onClick={(event) => {
        trigger.current = event.currentTarget;
        if (panel === 'filters') closePanel();
        else { closePanel(); setPanel('filters'); }
      }} />
    <NetworkToolButton icon="link" label="添加连线" aria-pressed={Boolean(linkStep)} disabled={linkDisabled}
      onClick={() => { closePanel(); onToggleLink(); }} />
    <NetworkToolButton icon="add" label="新建词条" aria-haspopup="dialog" disabled={Boolean(linkStep)}
      onClick={() => { closePanel(); onNewEntry(); }} />
    <NetworkToolButton icon={fullscreen ? 'collapse' : 'expand'} label={fullscreen ? '退出全屏' : '全屏画布'} onClick={onFullscreen} />
    <NetworkToolButton icon="undo" label="撤销画布操作" title="撤销 · Ctrl+Z" aria-keyshortcuts="Control+Z Meta+Z"
      disabled={!historyAvailable.undo || Boolean(linkStep)} onClick={() => onHistory('undo')} />
    <NetworkToolButton icon="redo" label="重做画布操作" title="重做 · Ctrl+Shift+Z" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
      disabled={!historyAvailable.redo || Boolean(linkStep)} onClick={() => onHistory('redo')} />
    {linkStep ? <span className="network-tool-status" role="status">{linkStep}</span> : filterStatus && (
      <span className="network-tool-status" title={filterStatus}>{filterStatus}</span>
    )}

    {panel === 'search' && <div className="network-tool-panel" id="network-node-search">
      <input ref={search} type="search" aria-label="节点关键词" placeholder="词条、日志标题或脚本名" value={query}
        onChange={(event) => onQuery(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing && results[0]) choose(results[0]);
        }} />
      {query.trim() && (results.length ? <div className="network-search-results">
        {(['entry', 'log', 'code'] as const).map((kind) => {
          const group = results.filter((node) => node.kind === kind);
          return group.length ? <section key={kind} aria-label={RELATION_KIND_LABELS[kind]}>
            <h4>{RELATION_KIND_LABELS[kind]}</h4>
            {group.map((node) => <button type="button" data-kind={node.kind} key={relationNodeKey(node)} onClick={() => choose(node)}>
              <strong>{node.title}</strong>{node.detail && <small>{node.detail}</small>}
            </button>)}
          </section> : null;
        })}
      </div> : <p className="relation-muted">没有匹配的节点。</p>)}
    </div>}

    {panel === 'filters' && <div className="network-tool-panel network-filter-panel" id="network-filters">
      <div className="network-layers" role="group" aria-label="知识网络图层">
        <span className="network-layer-term" data-kind="entry">知识词条</span>
        {(['log', 'code'] as const).map((layer) => <button key={layer} type="button" data-kind={layer}
          aria-pressed={layers[layer]} onClick={() => onToggleLayer(layer)}>{RELATION_KIND_LABELS[layer]}</button>)}
      </div>
      {categories.length > 0 && <fieldset className="network-module-picker" aria-label="模块可见性">
        <legend>模块可见性（{visibleModules.length}/{categories.length}）</legend>
        <div className="network-module-actions">
          <button type="button" disabled={allModulesVisible} onClick={() => onModules(null)}>显示全部</button>
          <button type="button" disabled={visibleModules.length === 0} onClick={() => onModules([])}>全部隐藏</button>
        </div>
        <div className="network-module-options">
          {categories.map((category) => <label className="network-filter-option" key={category}>
            <input type="checkbox" checked={visibleModules.includes(category)} onChange={(event) => onModules(event.target.checked
              ? [...visibleModules, category] : visibleModules.filter((item) => item !== category))} />
            <span>{category || '未分类'}</span>
          </label>)}
        </div>
      </fieldset>}
      <label className="network-filter-option">
        <input type="checkbox" checked={crossOnly} disabled={!crossOnly && categories.length < 2}
          onChange={(event) => onCrossOnly(event.target.checked)} />
        只看跨模块关联
      </label>
      <label>显示范围
        <select value={hops} disabled={!canFocus || crossOnly} onChange={(event) => onHops(Number(event.target.value))}>
          <option value={0}>全网</option>
          <option value={1}>选中节点的一跳</option>
          <option value={2}>选中节点的两跳</option>
        </select>
      </label>
    </div>}
  </div>;
}
