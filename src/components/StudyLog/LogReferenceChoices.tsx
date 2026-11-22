import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { entryCitationMarkdown } from '../../utils/entryCitation';
import SearchableSelect from '../common/SearchableSelect';
import LogCodeCitationPicker from './LogCodeCitationPicker';

function EntryCitationPicker({ initialQuery, onInsert }: { initialQuery: string; onInsert: (id: string, title: string) => void }) {
  const { entries, isLoaded, error, loadKnowledge } = useKnowledgeStore();
  const [id, setId] = useState('');
  const entry = entries.find((item) => item.id === id);
  useEffect(() => { if (!isLoaded) loadKnowledge(); }, [isLoaded, loadKnowledge]);
  return <div className="code-form">
    {error && <p role="alert">{error}</p>}
    <SearchableSelect inline={{ initialQuery }} label="引用词条" placeholder="按名称、别名或分类筛选"
      options={entries.map(({ id, title, aliases, category }) => ({ id, label: title, fields: [...aliases, category] }))}
      value={id} onChange={setId} />
    <button type="button" className="note-button" disabled={!entry}
      onClick={() => { if (entry) onInsert(entry.id, entry.title); }}>插入到正文</button>
  </div>;
}

export default function LogReferenceChoices({ selectedText, insert }: {
  selectedText: string;
  insert: (text: string, afterSelectionSeparator?: string) => void;
}) {
  const [kind, setKind] = useState<'entry' | 'code'>();
  const choices = useRef<HTMLDivElement>(null);
  const initialQuery = selectedText.trim().split('\n', 1)[0];
  useLayoutEffect(() => {
    choices.current?.querySelector<HTMLElement>(kind ? '[role="combobox"]' : 'button')?.focus({ preventScroll: true });
  }, [kind]);
  return <div ref={choices}>
    {!kind ? <>
      <button type="button" onClick={() => setKind('entry')}>引用词条</button>
      <button type="button" onClick={() => setKind('code')}>引用项目代码</button>
    </> : <>
      <button type="button" onClick={() => setKind(undefined)}>← 返回插入选项</button>
      {kind === 'code' ? <LogCodeCitationPicker initialQuery={initialQuery} onInsert={(markdown) => insert(markdown, ' ')} />
        : <EntryCitationPicker initialQuery={initialQuery} onInsert={(id, title) => {
          const caption = selectedText.trim();
          if (caption && !/[\r\n]/.test(caption)) {
            const start = selectedText.indexOf(caption);
            insert(selectedText.slice(0, start) + entryCitationMarkdown(id, caption) + selectedText.slice(start + caption.length));
          } else {
            insert(entryCitationMarkdown(id, title), ' ');
          }
        }} />}
    </>}
  </div>;
}
