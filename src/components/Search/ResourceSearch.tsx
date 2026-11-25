import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { hasWorkspaceEditor, searchHref, useWorkspaceStore } from '../../store/workspaceStore';
import { normalizedName } from '../../utils/knowledge';
import type { PracticeSelection } from '../../utils/practiceReview';
import type { SearchPage, SearchResultSet, SearchScope } from '../../utils/resourceSearch';
import { matchExcerpt, matchScriptLine } from '../../utils/searchMatches';
import HighlightedText from '../common/HighlightedText';
import InlineReveal from '../common/InlineReveal';
import { RESOURCE_GROUPS, useResourceSearchResults } from './useResourceSearchResults';

function PracticeSearchResult({ title, link, children, review }: {
  title: string;
  link: ReactNode;
  children: ReactNode;
  review: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const label = open ? '收起复盘' : '复盘';
  return <li onKeyDown={(event) => {
    if (!open || event.key !== 'Escape' || event.nativeEvent.isComposing || event.defaultPrevented) return;
    event.preventDefault();
    setOpen(false);
  }}>
    <div className="search-practice-result">
      {link}
      <button ref={trigger} type="button" className="workspace-button" aria-label={`${label} ${title}`}
        aria-controls={panelId} aria-expanded={open} onClick={() => setOpen(!open)}>{label}</button>
    </div>
    {children}
    <InlineReveal id={panelId} open={open} trigger={trigger}>
      <div className="search-practice-review">{review}</div>
    </InlineReveal>
  </li>;
}

export function SearchResults({ query, results, editingPages, limit, onOpen, renderPracticeReview }: {
  query: string;
  results: SearchResultSet;
  editingPages?: SearchPage[];
  limit?: number;
  onOpen: (newTab: boolean) => void;
  renderPracticeReview?: (practice: PracticeSelection) => ReactNode;
}) {
  const { groups, count, words, checkingCode, errors } = results;

  return (
    <div className="search-results">
      <p className="search-muted" role="status">{count ? `${count} 条匹配结果` : checkingCode ? '正在读取项目代码…' : '没有匹配的资料。'}</p>
      {errors.map((error) => <p key={error} className="search-muted">{error}</p>)}
      {groups.filter(({ items }) => items.length > 0).map(({ page, label, items }) => {
        const newTab = editingPages?.includes(page) ?? hasWorkspaceEditor(page);
        return (
          <section key={page} aria-label={label}>
            <h3>{label}（{items.length}）</h3>
            {newTab && <p className="search-muted">该页有编辑表单，结果将在新标签页打开。</p>}
            <ul>{items.slice(0, limit ?? items.length).map(({ href, title, detail, fields, source, tags, practice }) => {
              const hit = source ? matchScriptLine(source, words) : undefined;
              const excerpt = words.length ? hit?.excerpt ?? matchExcerpt(fields, words) : fields[0]?.slice(0, 100);
              const matchedTags = tags?.filter((tag) => words.some((word) => normalizedName(tag).includes(word))) ?? [];
              const target = words.length ? searchHref(href, query, Boolean(hit)) : href;
              const link = <a href={target} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener' : undefined} onClick={(event) => {
                const inNewTab = editingPages?.includes(page) ?? hasWorkspaceEditor(page);
                const link = event.currentTarget;
                link.target = inNewTab ? '_blank' : '';
                link.rel = inNewTab ? 'noopener' : '';
                onOpen(inNewTab || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey);
                if (!inNewTab && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && window.location.hash === target) {
                  useWorkspaceStore.getState().syncHash();
                }
              }}><HighlightedText text={title} words={words} /></a>;
              const description = <>
                {detail && <p className="search-muted"><HighlightedText text={detail} words={words} /></p>}
                {matchedTags.length > 0 && <p className="search-muted">匹配标签 · <HighlightedText text={matchedTags.join('、')} words={words} /></p>}
                {excerpt && !matchedTags.includes(excerpt) && <p className="search-excerpt">{hit && <span className="search-muted">第 {hit.line} 行 · </span>}<HighlightedText text={excerpt} words={words} /></p>}
              </>;
              return practice && renderPracticeReview
                ? <PracticeSearchResult key={href} title={title} link={link} review={renderPracticeReview(practice)}>{description}</PracticeSearchResult>
                : <li key={href}>{link}{description}</li>;
            })}</ul>
            {limit && items.length > limit && <p className="search-muted">显示前 {limit} 条，可补充关键词缩小范围。</p>}
          </section>
        );
      })}
    </div>
  );
}

export default function ResourceSearch({ triggerContent = '检索' }: { triggerContent?: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [includeSource, setIncludeSource] = useState(false);
  const [editingPages, setEditingPages] = useState<SearchPage[] | null>(null);
  const results = useResourceSearchResults({ query, scope, includeSource: scope === 'code' && includeSource,
    active: Boolean(editingPages && query.trim()) });
  const { words } = results;

  const open = () => {
    // 各页面切换后仍挂载。若结果页已有表单，在另一标签页阅读可保留原草稿。
    setEditingPages(RESOURCE_GROUPS.map(({ page }) => page).filter(hasWorkspaceEditor));
    dialog.current?.showModal();
    input.current?.focus();
  };
  const close = () => dialog.current?.close();

  return (
    <>
      <button type="button" className="open-resource-search" title="检索资料" aria-label="检索资料" aria-haspopup="dialog" onClick={open}>{triggerContent}</button>
      <dialog ref={dialog} className="resource-search" aria-labelledby="resource-search-title"
        onClose={() => setEditingPages(null)} onKeyDown={(event) => {
          if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
            event.preventDefault();
            close();
          }
        }}>
        <header className="resource-search-heading">
          <h2 id="resource-search-title">检索资料</h2>
          <button type="button" onClick={close} className="note-button secondary">关闭</button>
        </header>
        <input ref={input} className="search-input" type="search" autoComplete="off" aria-label="检索关键词"
          placeholder={scope === 'history' ? '搜索日志日期、标签或正文' : '例如 Tilemap、InputManager.cs'}
          value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="search-filters" role="group" aria-label="按资料类型筛选">
          <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>全部</button>
          {RESOURCE_GROUPS.map(({ page, label }) => <button type="button" key={page} aria-pressed={scope === page} onClick={() => setScope(page)}>{label}</button>)}
        </div>
        {scope === 'code' && <label className="search-source-option">
          <input type="checkbox" checked={includeSource} onChange={(event) => setIncludeSource(event.target.checked)} />
          搜索脚本正文（本地快照）
        </label>}
        {words.length === 0 && <p className="search-muted">{scope === 'history' ? '输入标签名可查找带该标签的日志。' : '输入关键词查找日志、词条、代码或实践卡片。'}</p>}
        {editingPages && words.length > 0 && <SearchResults query={query} results={results} editingPages={editingPages} onOpen={close} />}
      </dialog>
    </>
  );
}
