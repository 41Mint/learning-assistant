import { useMemo, useRef, useState } from 'react';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import { logLabel } from '../../utils/growth';
import { codeVersionHref } from '../../utils/projectCode';
import { codeSearchFields, entrySearchFields, logSearchFields, matchExcerpt, matchesWords, searchWords } from '../../utils/resourceSearch';

const GROUPS = [
  { page: 'history', label: '学习日志' },
  { page: 'knowledge', label: '知识词条' },
  { page: 'code', label: '代码版本' },
] as const;

type SearchPage = typeof GROUPS[number]['page'];
type SearchScope = 'all' | SearchPage;
interface SearchRecord {
  href: string;
  title: string;
  detail?: string;
  fields: string[];
}

function SearchResults({ words, scope, editingPages, onOpen }: {
  words: string[];
  scope: SearchScope;
  editingPages: SearchPage[];
  onOpen: () => void;
}) {
  const logs = useStudyLogStore((state) => state.logs);
  const { entries, error: knowledgeError } = useKnowledgeStore();
  const { data: code, isLoaded: codeLoaded, error: codeError } = useProjectCodeStore();
  const records = useMemo<Record<SearchPage, SearchRecord[]>>(() => {
    const projects = new Map(code.projects.map((project) => [project.id, project.name]));
    return {
      history: [...logs].sort((a, b) => b.date.localeCompare(a.date)).map((log) => ({
        href: '#history/' + encodeURIComponent(log.date), title: logLabel(log), fields: logSearchFields(log),
      })),
      knowledge: [...entries].sort((a, b) => a.title.localeCompare(b.title, 'zh-CN')).map((entry) => ({
        href: '#knowledge/' + encodeURIComponent(entry.id), title: entry.title, detail: entry.category, fields: entrySearchFields(entry),
      })),
      code: [...code.versions].sort((a, b) => b.savedAt - a.savedAt).map((version) => {
        const projectName = projects.get(version.projectId) ?? '';
        return {
          href: codeVersionHref(version.id), title: version.path,
          detail: [projectName, new Date(version.savedAt).toLocaleString('zh-CN')].filter(Boolean).join(' · '),
          fields: codeSearchFields(version, projectName),
        };
      }),
    };
  }, [logs, entries, code]);
  const groups = GROUPS.filter(({ page }) => scope === 'all' || scope === page).map((group) => ({
    ...group,
    items: records[group.page].filter(({ fields }) => matchesWords(fields, words)),
  }));
  const count = groups.reduce((total, group) => total + group.items.length, 0);
  const checkingCode = (scope === 'all' || scope === 'code') && !codeLoaded;

  return (
    <div className="search-results">
      <p className="search-muted" role="status">{count ? `${count} 条匹配结果` : checkingCode ? '正在读取项目代码…' : '没有匹配的资料。'}</p>
      {(scope === 'all' || scope === 'knowledge') && knowledgeError && <p className="search-muted">知识词条暂时无法读取。</p>}
      {(scope === 'all' || scope === 'code') && codeError && <p className="search-muted">项目代码暂时无法读取。</p>}
      {groups.filter(({ items }) => items.length > 0).map(({ page, label, items }) => {
        const newTab = editingPages.includes(page);
        return (
          <section key={page} aria-label={label}>
            <h3>{label}（{items.length}）</h3>
            {newTab && <p className="search-muted">该页有编辑表单，结果将在新标签页打开。</p>}
            <ul>{items.map(({ href, title, detail, fields }) => {
              const excerpt = matchExcerpt(fields, words);
              return <li key={href}>
                <a href={href} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener' : undefined} onClick={onOpen}>{title}</a>
                {detail && <p className="search-muted">{detail}</p>}
                {excerpt && <p className="search-excerpt">{excerpt}</p>}
              </li>;
            })}</ul>
          </section>
        );
      })}
    </div>
  );
}

export default function ResourceSearch() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [editingPages, setEditingPages] = useState<SearchPage[] | null>(null);
  const words = searchWords(query);

  const open = () => {
    // 各页面切换后仍挂载。若结果页已有表单，在另一标签页阅读可保留原草稿。
    setEditingPages(GROUPS.map(({ page }) => page).filter((page) => document.getElementById(page)?.querySelector('form')));
    dialog.current?.showModal();
    input.current?.focus();
  };
  const close = () => dialog.current?.close();

  return (
    <>
      <button type="button" className="open-resource-search" aria-label="检索资料" aria-haspopup="dialog" onClick={open}>检索</button>
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
        <input ref={input} className="search-input" type="search" aria-label="检索关键词" placeholder="例如 Tilemap、InputManager.cs"
          value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="search-filters" role="group" aria-label="按资料类型筛选">
          <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>全部</button>
          {GROUPS.map(({ page, label }) => <button type="button" key={page} aria-pressed={scope === page} onClick={() => setScope(page)}>{label}</button>)}
        </div>
        {words.length === 0 && <p className="search-muted">输入关键词，在日志、词条与代码版本中查找。</p>}
        {editingPages && words.length > 0 && <SearchResults words={words} scope={scope} editingPages={editingPages} onOpen={close} />}
      </dialog>
    </>
  );
}
