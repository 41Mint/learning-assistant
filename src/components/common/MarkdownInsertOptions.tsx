import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { entryCitationMarkdown } from '../../utils/entryCitation';
import { imageMarkdown, prepareImageFile } from '../../utils/imageStorage';
import type { StoredImage } from '../../utils/imageStorage';
import type { MarkdownInsertOptionsProps } from './MarkdownFields';
import SearchableSelect from './SearchableSelect';
import CodeCitationPicker from './CodeCitationPicker';

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

type ImageSelection = { status: 'reading' } | { status: 'ready'; images: StoredImage[] } | { status: 'error'; message: string };

function ImageInsertOptions({ insertBlock }: Pick<MarkdownInsertOptionsProps, 'insertBlock'>) {
  const [selection, setSelection] = useState<ImageSelection>();
  const request = useRef(0);
  const prepare = async (input: HTMLInputElement) => {
    const files = Array.from(input.files ?? []);
    const version = ++request.current;
    setSelection(files.length ? { status: 'reading' } : undefined);
    if (!files.length) return;
    try {
      const images = await Promise.all(files.map(prepareImageFile));
      if (version === request.current) setSelection({ status: 'ready', images });
    } catch (error) {
      if (version !== request.current) return;
      input.value = '';
      setSelection({ status: 'error', message: error instanceof Error ? error.message : '读取图片失败，请重试。' });
    }
  };
  return <div className="code-form">
    <label>本地图片（可多选）<input type="file" multiple accept="image/png,image/jpeg,image/gif,image/webp"
      onChange={(event) => void prepare(event.currentTarget)} /></label>
    {selection?.status === 'reading' && <p className="knowledge-muted" role="status">正在读取图片…</p>}
    {selection?.status === 'error' && <p role="alert">{selection.message}</p>}
    <button type="button" className="note-button" disabled={selection?.status !== 'ready'} onClick={() => {
      if (selection?.status !== 'ready') return;
      const markdown = selection.images.map(({ id, name }) => imageMarkdown(id, name.replace(/\.[^.]+$/, '').replace(/\s+/g, ' ').trim() || '图片'));
      insertBlock(markdown.join('\n\n'), { images: selection.images });
    }}>插入到正文</button>
  </div>;
}

function countOptions(maximum: number) {
  return Array.from({ length: maximum }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>);
}

function TableInsertOptions({ insertBlock }: Pick<MarkdownInsertOptionsProps, 'insertBlock'>) {
  const [rows, setRows] = useState(2);
  const [columns, setColumns] = useState(2);
  const insertTable = () => {
    const headers = Array.from({ length: columns }, (_, index) => `列 ${index + 1}`);
    const header = '| ' + headers.join(' | ') + ' |';
    const separator = '|' + ' --- |'.repeat(columns);
    const body = Array.from({ length: rows }, () => '|' + '  |'.repeat(columns));
    insertBlock([header, separator, ...body].join('\n'), { selection: [2, 2 + headers[0].length] });
  };
  return <div className="code-form">
    <div className="markdown-insert-table-size">
      <label>正文行数<select value={rows} onChange={(event) => setRows(Number(event.currentTarget.value))}>{countOptions(20)}</select></label>
      <label>列数<select value={columns} onChange={(event) => setColumns(Number(event.currentTarget.value))}>{countOptions(12)}</select></label>
    </div>
    <button type="button" className="note-button" onClick={insertTable}>插入到正文</button>
  </div>;
}

export default function MarkdownInsertOptions({ selectedText, insert, insertBlock }: MarkdownInsertOptionsProps) {
  const [kind, setKind] = useState<'entry' | 'code' | 'image' | 'table'>();
  const choices = useRef<HTMLDivElement>(null);
  const initialQuery = selectedText.trim().split('\n', 1)[0];
  useLayoutEffect(() => {
    choices.current?.querySelector<HTMLElement>(kind ? 'input, select' : 'button')?.focus({ preventScroll: true });
  }, [kind]);
  const insertEntry = (id: string, title: string) => {
    const caption = selectedText.trim();
    if (caption && !/[\r\n]/.test(caption)) {
      const start = selectedText.indexOf(caption);
      insert(selectedText.slice(0, start) + entryCitationMarkdown(id, caption) + selectedText.slice(start + caption.length));
    } else {
      insert(entryCitationMarkdown(id, title), ' ');
    }
  };
  const panels = {
    code: <CodeCitationPicker initialQuery={initialQuery} onInsert={(markdown) => insert(markdown, ' ')} />,
    entry: <EntryCitationPicker initialQuery={initialQuery} onInsert={insertEntry} />,
    image: <ImageInsertOptions insertBlock={insertBlock} />,
    table: <TableInsertOptions insertBlock={insertBlock} />,
  };
  return <div ref={choices}>
    {!kind ? <>
      <button type="button" onClick={() => setKind('entry')}>引用词条</button>
      <button type="button" onClick={() => setKind('code')}>引用项目代码</button>
      <button type="button" onClick={() => setKind('image')}>插入图片</button>
      <button type="button" onClick={() => setKind('table')}>插入表格</button>
      <button type="button" onClick={() => insertBlock('---')}>插入分隔线</button>
    </> : <>
      <button type="button" onClick={() => setKind(undefined)}>← 返回插入选项</button>
      {panels[kind]}
    </>}
  </div>;
}
