import { useId, useState } from 'react';
import type { KnowledgeEntry } from '../../types';
import FocusEditor from '../common/FocusEditor';
import ReferenceChoices from '../common/ReferenceChoices';

export type CategoryEditorTarget = { kind: 'rename' | 'members'; category: string } | { kind: 'batch'; ids: string[] };

export default function NetworkCategoryEditor({ title, target, entries, categories, onSave, onCancel }: {
  title: string;
  target: CategoryEditorTarget;
  entries: KnowledgeEntry[];
  categories: string[];
  onSave: (ids: string[], category: string) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState(target.kind === 'rename' ? target.category : '');
  const [selection, setSelection] = useState(entries.map(({ id }) => id));
  const [error, setError] = useState('');
  const categoryId = useId();
  const destination = category.trim();
  const changed = entries.filter((entry) => selection.includes(entry.id) && entry.category !== destination);
  const description = target.kind === 'batch' ? `已选 ${entries.length} 个词条。`
    : `${target.category || '未分类'} · ${entries.length} 个词条`;
  const merging = target.kind === 'rename' && changed.length > 0 && categories.includes(destination);
  const save = () => {
    try { onSave(changed.map(({ id }) => id), destination); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '分类保存失败。'); }
  };
  return <FocusEditor title={title} description={description} formLabel={title} saveLabel="保存分类"
    saveDisabled={!changed.length} error={error} onSave={save} onCancel={onCancel}>
    {target.kind === 'members' && <>
      <div className="network-actions">
        <button type="button" className="note-button secondary" onClick={() => setSelection(entries.map(({ id }) => id))}>全选成员</button>
        <button type="button" className="note-button secondary" onClick={() => setSelection([])}>清空选择</button>
      </div>
      <ReferenceChoices title="选择要移动的词条" initiallyOpen
        options={entries.map(({ id, title, aliases }) => ({ id, label: title, fields: aliases }))}
        selected={selection} onChange={setSelection} />
    </>}
    <div className="entry-basics network-category-basics">
      <label>目标分类
        <input list={categoryId} value={category} placeholder="输入分类名称，留空归入未分类"
          onChange={(event) => { setCategory(event.target.value); setError(''); }} />
      </label>
      <datalist id={categoryId}>{categories.filter(Boolean).map((name) => <option key={name} value={name} />)}</datalist>
      {changed.length > 0 && <p className="relation-muted">
        {merging ? `将 ${changed.length} 个词条合并到「${destination || '未分类'}」。`
          : `将 ${changed.length} 个词条移至「${destination || '未分类'}」。`}
      </p>}
    </div>
  </FocusEditor>;
}
