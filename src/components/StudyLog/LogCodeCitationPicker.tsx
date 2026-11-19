import { useEffect, useState } from 'react';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { scriptLines } from '../../utils/assistantCode';
import { codeCitationMarkdown, parseCodeLines } from '../../utils/codeCitation';
import { codeVersionLabel } from '../../utils/projectCode';
import SearchableSelect from '../common/SearchableSelect';

export default function LogCodeCitationPicker({ onInsert }: { onInsert: (markdown: string) => void }) {
  const { data, isLoaded, error, load } = useProjectCodeStore();
  const [id, setId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [label, setLabel] = useState('');
  const version = data.versions.find((item) => item.id === id);
  const lineCount = version?.content ? scriptLines(version.content).length : 0;
  const range = start.trim() ? parseCodeLines(start.trim(), end.trim() || start.trim()) : undefined;
  const invalid = Boolean(start.trim() || end.trim()) && (!range || range.endLine > lineCount);
  useEffect(() => { if (!isLoaded) void load(); }, [isLoaded, load]);
  return <div className="code-form">
    {error && <p role="alert">{error}</p>}
    {isLoaded && !error && data.versions.length === 0 && <p>请先在项目代码中保存一个版本。</p>}
    <SearchableSelect label="引用代码版本" placeholder="按文件、项目或版本说明筛选" value={id}
      options={data.versions.map((item) => ({ id: item.id, label: codeVersionLabel(item, data.projects.find((project) => project.id === item.projectId)?.name) }))}
      onChange={(next) => { setId(next); setStart(''); setEnd(''); }} />
    {version && <label>链接文字（可选）<input value={label} maxLength={120} onChange={(event) => setLabel(event.target.value)} placeholder="例如 Update()" /></label>}
    {lineCount > 0 && <div className="code-citation-fields">
      <label>起始行（可选）<input inputMode="numeric" value={start} onChange={(event) => setStart(event.target.value)} /></label>
      <label>结束行（可选）<input inputMode="numeric" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
    </div>}
    {lineCount > 0 && <p className="code-muted">{invalid ? `请填写 1–${lineCount} 内有效的行范围。`
      : `共 ${lineCount} 行。不填行号则引用完整版本，只填起始行则引用单行。`}</p>}
    <button type="button" className="note-button" disabled={!version || invalid} onClick={() => {
      if (!version || invalid) return;
      onInsert(codeCitationMarkdown(version.id, label.trim() || version.path.split('/').at(-1) || version.path, range));
    }}>插入到正文</button>
  </div>;
}
