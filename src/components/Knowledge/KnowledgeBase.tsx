import { useEffect, useState } from 'react';
import type { KnowledgeEntry } from '../../types';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import type { EntryInput } from '../../store/knowledgeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { entryNames, normalizedName } from '../../utils/knowledge';
import MarkdownContent from '../common/MarkdownContent';

interface EntryDraft extends EntryInput { id?: string }
const blankEntry = (): EntryDraft => ({ title: '', aliases: [], category: '', content: '' });

export default function KnowledgeBase() {
  const store = useKnowledgeStore();
  const loadKnowledge = store.loadKnowledge;
  const logs = useStudyLogStore((state) => state.logs);
  const { entryId, openEntry, openLog } = useWorkspaceStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [aliasesText, setAliasesText] = useState('');
  const [message, setMessage] = useState('');
  const [relatedId, setRelatedId] = useState('');
  useEffect(() => { loadKnowledge(); }, [loadKnowledge]);
  const selected = store.entries.find((entry) => entry.id === entryId);
  const categories = [...new Set(store.entries.map((entry) => entry.category))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const filtered = store.entries.filter((entry) => (category === null || entry.category === category)
    && entryNames(entry).some((name) => name.includes(normalizedName(query))));

  const perform = (action: () => void, success: string) => {
    try { action(); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : '操作失败，请重试。'); }
  };
  const select = (entry: KnowledgeEntry) => {
    if (draft && !window.confirm('是否放弃尚未保存的词条编辑？')) return;
    setDraft(null); setMessage(''); setRelatedId(''); openEntry(entry.id);
  };
  const edit = (entry?: KnowledgeEntry) => {
    if (draft && !window.confirm('是否放弃尚未保存的词条编辑？')) return;
    setDraft(entry ? { ...entry } : blankEntry());
    setAliasesText(entry?.aliases.join('，') ?? '');
    setMessage('');
  };
  const save = () => {
    if (!draft) return;
    perform(() => {
      const id = store.saveEntry({ ...draft, aliases: aliasesText.split(/[,，\n]/) }, draft.id);
      setDraft(null); setCategory(null); setQuery(''); openEntry(id);
    }, '词条已保存，关联的日志和词条会继续指向同一个词条。');
  };
  const links = selected ? store.logLinks.filter((link) => link.entryId === selected.id) : [];
  const related = selected ? store.relations.filter((relation) => relation.sourceId === selected.id || relation.targetId === selected.id) : [];

  return (
    <div className="knowledge-workspace">
      <aside className="module-card knowledge-catalog" aria-label="词条目录">
        <h2>知识词条</h2>
        <p className="knowledge-muted">把反复遇到的知识逐步整理成自己的词条。</p>
        <button type="button" className="note-button" onClick={() => edit()} disabled={Boolean(store.error)}>新建词条</button>
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

      <section className="module-card knowledge-detail" aria-label="词条详情">
        {store.error ? <p role="alert">{store.error}</p> : draft ? (
          <div className="knowledge-editor">
            <h2>{draft.id ? '编辑词条' : '新建词条'}</h2>
            <p className="knowledge-muted">只需名称即可保存。自己的理解、实例和疑问可随学习补充。</p>
            {selected && draft.id && draft.id !== selected.id && <p role="status">当前仍在编辑此前的词条，保存或取消后可查看新选择的词条。</p>}
            <label htmlFor="entry-title">词条名称（必填）</label>
            <input id="entry-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            <label htmlFor="entry-aliases">别名（用逗号分隔）</label>
            <input id="entry-aliases" value={aliasesText} onChange={(event) => setAliasesText(event.target.value)} />
            <label htmlFor="entry-category">分类（可选）</label>
            <input id="entry-category" list="entry-categories" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="例如：2D 素材" />
            <datalist id="entry-categories">{categories.filter(Boolean).map((item) => <option key={item} value={item} />)}</datalist>
            <div className="editor-grid">
              <div className="editor-pane"><label className="editor-pane-label" htmlFor="entry-content">词条正文（Markdown）</label><textarea id="entry-content" className="editor-pane-area" value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="我的理解、使用例子、仍有疑问…" /></div>
              <div className="editor-pane"><p className="editor-pane-label">实时预览</p><div className="markdown-preview editor-pane-area"><MarkdownContent content={draft.content || '尚未填写正文。'} /></div></div>
            </div>
            <button type="button" className="note-button" disabled={!draft.title.trim()} onClick={save}>保存词条</button>
            <button type="button" className="note-button secondary" onClick={() => { setDraft(null); setMessage('已取消编辑。'); }}>取消词条编辑</button>
          </div>
        ) : selected ? (
          <>
            <div className="knowledge-detail-heading"><div><span className="knowledge-muted">{selected.category || '未分类'}</span><h2>{selected.title}</h2></div>
              <div><button type="button" className="note-button" onClick={() => edit(selected)}>编辑词条</button><button type="button" className="knowledge-text-button danger" onClick={() => {
                if (window.confirm(`删除词条“${selected.title}”及其关联吗？原学习日志与图片会保留。`)) perform(() => store.deleteEntry(selected.id), '词条已删除，原学习日志保持不变。');
              }}>删除词条</button></div>
            </div>
            {selected.aliases.length > 0 && <p className="knowledge-muted">别名：{selected.aliases.join('、')}</p>}
            <div className="markdown-preview knowledge-entry-content"><MarkdownContent content={selected.content || '尚未填写正文。可先关联学习记录，之后补充自己的理解与疑问。'} /></div>
            <section className="knowledge-sources"><h3>相关学习记录（{links.length}）</h3>
              {!links.length && <p className="knowledge-muted">在今日或历史日志的“关联知识词条”中选择本词条，即可把原始情境关联到这里。</p>}
              <ul className="knowledge-source-list">{links.map((link) => {
                const log = logs.find((item) => item.id === link.logId);
                return <li key={link.id}>{log ? <a href={`#history/${log.date}`} onClick={(event) => { event.preventDefault(); openLog(log.date); }}>{log.date} · {log.content.match(/^#{1,6}\s+(.+)$/m)?.[1] ?? '学习记录'}</a> : <span>原记录暂不可用</span>}
                  {link.note && <p>{link.note}</p>}<button type="button" className="knowledge-text-button" onClick={() => perform(() => store.unlinkLog(link.id), '已解除关联，原日志仍保留。')}>解除日志关联</button></li>;
              })}</ul>
            </section>
            <section className="knowledge-related"><h3>相关词条</h3>
              <ul className="knowledge-linked-list">{related.map((relation) => {
                const other = store.entries.find((entry) => entry.id === (relation.sourceId === selected.id ? relation.targetId : relation.sourceId));
                return other && <li key={relation.id}><a href={`#knowledge/${encodeURIComponent(other.id)}`} onClick={(event) => { event.preventDefault(); select(other); }}>{other.title}</a><button type="button" className="knowledge-text-button" onClick={() => perform(() => store.removeRelation(relation.id), '已解除词条关联。')}>解除词条关联</button></li>;
              })}</ul>
              <label htmlFor="related-entry">选择相关词条</label><select id="related-entry" value={relatedId} onChange={(event) => setRelatedId(event.target.value)}><option value="">请选择</option>{store.entries.filter((entry) => entry.id !== selected.id).map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select>
              <button type="button" className="note-button secondary" disabled={!relatedId} onClick={() => perform(() => { store.relate(selected.id, relatedId); setRelatedId(''); }, '相关词条已保存，双方均可查看。')}>添加相关词条</button>
            </section>
          </>
        ) : <><h2>{entryId ? '词条未找到' : '选择或新建一个知识词条'}</h2><p className="knowledge-muted">从左侧目录选择词条，或从学习日志中为反复遇到的知识创建词条。</p></>}
        {message && <p className="knowledge-message" role="status">{message}</p>}
      </section>
    </div>
  );
}
