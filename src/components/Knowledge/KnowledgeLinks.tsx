import { useEffect, useId, useState } from 'react';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { entryNames, normalizedName } from '../../utils/knowledge';

export default function KnowledgeLinks({ logId, legacyPoints = [] }: { logId: string; legacyPoints?: string[] }) {
  const store = useKnowledgeStore();
  const loadKnowledge = store.loadKnowledge;
  const openEntry = useWorkspaceStore((state) => state.openEntry);
  const [entryId, setEntryId] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const formId = useId();
  useEffect(() => { loadKnowledge(); }, [loadKnowledge]);
  const links = store.logLinks.filter((link) => link.logId === logId);

  const execute = (action: () => void) => {
    try { action(); setMessage('关联已保存。点击词条名称可查看和补充。'); }
    catch (error) { setMessage(error instanceof Error ? error.message : '保存失败，请重试。'); }
  };
  const create = (name: string) => execute(() => {
    store.saveEntry({ title: name, aliases: [], category: '', content: '' }, undefined, logId, note);
    setTitle('');
  });

  return (
    <section className="knowledge-log-links" aria-label="关联知识词条">
      <h3>关联知识词条</h3>
      {store.error ? <p role="alert">{store.error}</p> : <>
        {links.length > 0 ? <ul className="knowledge-linked-list">{links.map((link) => {
          const entry = store.entries.find((item) => item.id === link.entryId);
          return entry && <li key={link.id}>
            <a href={`#knowledge/${encodeURIComponent(entry.id)}`} onClick={(event) => { event.preventDefault(); openEntry(entry.id); }}>{entry.title}</a>
            {link.note && <span className="knowledge-muted">{link.note}</span>}
            <button type="button" className="knowledge-text-button" aria-label={`解除与${entry.title}的关联`} onClick={() => execute(() => store.unlinkLog(link.id))}>解除关联</button>
          </li>;
        })}</ul> : <p className="knowledge-muted">将值得持续整理的内容关联到词条，之后可从词条找回这篇记录。</p>}
        <details>
          <summary>关联已有词条 / 新建词条</summary>
          <div className="knowledge-link-form">
            <label htmlFor={`${formId}-entry`}>已有词条</label>
            <select id={`${formId}-entry`} value={entryId} onChange={(event) => {
              setEntryId(event.target.value);
              setNote(store.logLinks.find((link) => link.entryId === event.target.value && link.logId === logId)?.note ?? '');
            }}>
              <option value="">请选择</option>
              {store.entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
            </select>
            <label htmlFor={`${formId}-note`}>关联说明（可选）</label>
            <input id={`${formId}-note`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：初次接触，见 PPU 小节" />
            <button type="button" className="note-button" disabled={!entryId || !store.isLoaded} onClick={() => execute(() => store.linkLog(entryId, logId, note))}>关联选中词条 / 更新说明</button>
            <label htmlFor={`${formId}-title`}>新词条名称</label>
            <input id={`${formId}-title`} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：PPU" />
            <button type="button" className="note-button secondary" disabled={!title.trim() || !store.isLoaded} onClick={() => create(title)}>新建并关联</button>
            {legacyPoints.length > 0 && <div className="legacy-knowledge-points">
              <p className="knowledge-muted">旧知识点文字保留原样。可选择下列内容建立词条关联：</p>
              {legacyPoints.map((point) => {
                const existing = store.entries.find((entry) => entryNames(entry).includes(normalizedName(point)));
                return <button type="button" className="knowledge-chip" key={point} onClick={() => existing ? execute(() => store.linkLog(existing.id, logId, note)) : create(point)}>{existing ? '关联已有：' : '创建并关联：'}{point}</button>;
              })}
            </div>}
          </div>
        </details>
      </>}
      {message && <p role="status" className="knowledge-muted">{message}</p>}
    </section>
  );
}
