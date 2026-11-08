import { useEffect, useRef, useState } from 'react';
import type { KnowledgeEntry } from '../../types';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { logLabel } from '../../utils/growth';
import { entryNames, normalizedName, otherEntryId } from '../../utils/knowledge';
import { codeVersionHref, codeVersionLabel, entryCodeIds } from '../../utils/projectCode';
import MarkdownContent from '../common/MarkdownContent';
import HighlightedText from '../common/HighlightedText';
import { useScrollToSearchMatch } from '../common/useScrollToSearchMatch';
import KnowledgeEditor from './KnowledgeEditor';

export default function KnowledgeBase() {
  const store = useKnowledgeStore();
  const loadKnowledge = store.loadKnowledge;
  const logs = useStudyLogStore((state) => state.logs);
  const code = useProjectCodeStore((state) => state.data);
  const { entryId, openEntry, openLog, search: searchLocation } = useWorkspaceStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ entry?: KnowledgeEntry } | null>(null);
  const [message, setMessage] = useState('');
  const editTrigger = useRef<HTMLButtonElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const detail = useRef<HTMLElement>(null);
  useEffect(() => { loadKnowledge(); }, [loadKnowledge]);
  const selected = store.entries.find((entry) => entry.id === entryId);
  const search = searchLocation?.page === 'knowledge' && searchLocation.id === entryId ? searchLocation : null;
  useScrollToSearchMatch(detail, search, selected?.content);
  const categories = [...new Set(store.entries.map((entry) => entry.category))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const filtered = store.entries.filter((entry) => (category === null || entry.category === category)
    && entryNames(entry).some((name) => name.includes(normalizedName(query))));

  const select = (entry: KnowledgeEntry) => {
    setMessage('');
    openEntry(entry.id);
  };
  const edit = (trigger: HTMLButtonElement, entry?: KnowledgeEntry) => {
    editTrigger.current = trigger;
    setDraft({ entry });
    setMessage('');
  };
  const save = (id: string) => {
    setDraft(null);
    setCategory(null);
    setQuery('');
    openEntry(id);
    setMessage('词条已保存。');
    window.requestAnimationFrame(() => detailHeading.current?.focus());
  };
  const remove = (entry: KnowledgeEntry) => {
    if (!window.confirm('确定删除词条“' + entry.title + '”及其关联？')) return;
    try {
      store.deleteEntry(entry.id);
      setMessage('词条已删除。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除失败，请重试。');
    }
  };
  const links = selected ? store.logLinks.filter((link) => link.entryId === selected.id) : [];
  const related = selected ? store.relations.flatMap((relation) => otherEntryId(relation, selected.id) ?? []) : [];
  const codeIds = selected ? entryCodeIds(selected, code.links) : [];

  return (
    <div className="knowledge-workspace" data-editing={Boolean(draft) || undefined}>
      {draft && (
        <section className="module-card knowledge-detail" aria-label="词条编辑">
          <KnowledgeEditor entry={draft.entry} categories={categories} onSave={save} onCancel={() => {
            setDraft(null);
            window.requestAnimationFrame(() => editTrigger.current?.focus());
          }} />
        </section>
      )}
      <aside className="module-card knowledge-catalog" aria-label="词条目录" hidden={Boolean(draft)}>
        <h2>知识词条</h2>
        <p className="knowledge-muted">把反复遇到的知识逐步整理成自己的词条。</p>
        <button type="button" className="note-button" onClick={(event) => edit(event.currentTarget)} disabled={Boolean(store.error)}>新建词条</button>
        <label htmlFor="knowledge-search">搜索名称或别名</label>
        <input id="knowledge-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="PPU / Pixels Per Unit" />
        <h3>分类目录</h3>
        <div className="knowledge-category-list">
          <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)}>全部（{store.entries.length}）</button>
          {categories.map((item) => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item || '未分类'}（{store.entries.filter((entry) => entry.category === item).length}）</button>)}
        </div>
        <h3>词条列表（{filtered.length}）</h3>
        <ul className="knowledge-entry-list">{filtered.map((entry) => <li key={entry.id}>
          <button type="button" aria-current={selected?.id === entry.id ? 'true' : undefined} onClick={() => select(entry)}>
            <strong>{entry.title}</strong><span>{entry.category || '未分类'} · {store.logLinks.filter((link) => link.entryId === entry.id).length} 条学习记录</span>
          </button>
        </li>)}</ul>
        {!filtered.length && <p className="knowledge-muted">{store.entries.length ? '没有匹配的词条。可调整搜索或分类。' : '还没有词条，可新建，也可从日志中创建并关联。'}</p>}
      </aside>

      <section ref={detail} className="module-card knowledge-detail" aria-label="词条详情" hidden={Boolean(draft)}>
        {store.error ? <p role="alert">{store.error}</p> : selected ? (
          <>
            <div className="knowledge-detail-heading">
              <div>
                <span className="knowledge-muted"><HighlightedText text={selected.category || '未分类'} words={search?.words} /></span>
                <h2 ref={detailHeading} tabIndex={-1}><HighlightedText text={selected.title} words={search?.words} /></h2>
              </div>
              <div>
                <button type="button" className="note-button" onClick={(event) => edit(event.currentTarget, selected)}>编辑词条</button>
                <button type="button" className="knowledge-text-button danger" onClick={() => remove(selected)}>删除词条</button>
              </div>
            </div>
            {selected.aliases.length > 0 && <p className="knowledge-muted">别名：<HighlightedText text={selected.aliases.join('、')} words={search?.words} /></p>}
            <div className="markdown-preview knowledge-entry-content" data-search-body>
              <MarkdownContent content={selected.content || '尚未填写正文。可先关联学习记录，之后补充自己的理解与疑问。'} searchWords={selected.content ? search?.words : undefined} />
            </div>
            {!links.length && !related.length && !codeIds.length && (
              <p className="knowledge-muted">可在“编辑词条”的关联资料中添加日志、词条或代码版本。</p>
            )}
            <section className="knowledge-sources" aria-label="相关学习记录"><h3>相关学习记录（{links.length}）</h3>
              <ul className="knowledge-source-list">{links.map((link) => {
                const log = logs.find((item) => item.id === link.logId);
                return <li key={link.id}>
                  {log ? <a href={`#history/${log.date}`} onClick={(event) => { event.preventDefault(); openLog(log.date); }}>{logLabel(log)}</a> : <span>原记录暂不可用</span>}
                  {link.note && <p>{link.note}</p>}
                </li>;
              })}</ul>
            </section>
            {related.length > 0 && <section className="knowledge-related" aria-label="相关词条"><h3>相关词条</h3>
              <ul className="knowledge-linked-list">{related.map((id) => {
                const other = store.entries.find((entry) => entry.id === id);
                return other && <li key={id}><a href={`#knowledge/${encodeURIComponent(id)}`} onClick={(event) => { event.preventDefault(); select(other); }}>{other.title}</a></li>;
              })}</ul>
            </section>}
            {codeIds.length > 0 && <section className="knowledge-sources" aria-label="项目用例"><h3>项目用例（{codeIds.length}）</h3>
              <ul className="code-link-list">{codeIds.map((id) => {
                const version = code.versions.find((item) => item.id === id);
                const project = version && code.projects.find((item) => item.id === version.projectId);
                return <li key={id}>
                  {version ? <a href={codeVersionHref(id)}>{codeVersionLabel(version, project?.name)}</a> : '关联代码已不可用'}
                </li>;
              })}</ul>
            </section>}
          </>
        ) : <><h2>{entryId ? '词条未找到' : '选择或新建一个知识词条'}</h2><p className="knowledge-muted">从左侧目录选择词条，或从学习日志中为反复遇到的知识创建词条。</p></>}
        {message && <p className="knowledge-message" role="status">{message}</p>}
      </section>
    </div>
  );
}
