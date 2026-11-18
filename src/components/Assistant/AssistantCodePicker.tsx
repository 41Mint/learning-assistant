import { useState } from 'react';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { makeCodeExcerpt, makeScriptReference, scriptLines } from '../../utils/assistantCode';
import { codeVersionLabel } from '../../utils/projectCode';
import { isScriptReference } from './assistantSlots';
import type { AssistantCodeReference } from './assistantSlots';
import CodeVersionForm from '../ProjectCode/CodeVersionForm';

export default function AssistantCodePicker({ current, onSelect, onBack }: {
  current?: AssistantCodeReference;
  onSelect: (reference: AssistantCodeReference) => void;
  onBack: () => void;
}) {
  const { data, isLoaded, error } = useProjectCodeStore();
  const versionId = useWorkspaceStore((state) => state.codeVersionId);
  const snapshots = data.versions.filter((version) => version.content?.trim());
  const [selected, setSelected] = useState(current?.versionId ?? versionId ?? '');
  const [importing, setImporting] = useState(false);
  const range = isScriptReference(current) ? undefined : current;
  const [start, setStart] = useState(String(range?.startLine ?? 1));
  const [end, setEnd] = useState(range ? String(range.endLine) : '');
  const version = snapshots.find(({ id }) => id === selected) ?? snapshots[0];
  const lines = version?.content ? scriptLines(version.content) : [];
  const from = Number(start);
  const to = end === '' ? from : Number(end);
  const valid = Number.isSafeInteger(from) && Number.isSafeInteger(to) && from >= 1 && to >= from && to <= lines.length;
  const excerpt = version && valid ? makeCodeExcerpt(version, from, lines.slice(from - 1, to).join('\n')) : undefined;
  return <section className="assistant-code-picker" aria-label="选择代码片段">
    <button type="button" className="knowledge-text-button" onClick={onBack}>← 返回问答</button>
    {error ? <p role="alert">{error}</p> : !isLoaded ? <p role="status">正在读取脚本…</p> : importing ?
      <CodeVersionForm onCancel={() => setImporting(false)} onSaved={(id) => {
        setSelected(id);
        setStart('1');
        setEnd('');
        setImporting(false);
      }} /> : !version ? <>
      <p>保存本地脚本快照后，就可以按行号提问。</p>
      <button type="button" className="note-button" onClick={() => setImporting(true)}>保存脚本</button>
    </> : <form className="assistant-code-picker" onSubmit={(event) => {
      event.preventDefault();
      if (excerpt) onSelect(excerpt);
    }}>
      <label>脚本版本<select value={version.id} onChange={(event) => { setSelected(event.target.value); setStart('1'); setEnd(''); }}>
        {snapshots.map((item) => <option key={item.id} value={item.id}>{codeVersionLabel(item, data.projects.find(({ id }) => id === item.projectId)?.name)}</option>)}
      </select></label>
      <div className="assistant-code-range">
        <label>起始行<input type="number" min={1} max={lines.length} required value={start} onChange={(event) => setStart(event.target.value)} /></label>
        <label>结束行<input type="number" min={1} max={lines.length} value={end} placeholder="同起始行" onChange={(event) => setEnd(event.target.value)} /></label>
      </div>
      <p className="knowledge-muted">共 {lines.length} 行。{!valid ? '请选择有效的行范围。' : !excerpt ? '请选择包含代码且不超过 8000 字符的范围。' : ''}</p>
      {excerpt && <pre aria-label="片段预览">{excerpt.text}</pre>}
      <div className="code-actions">
        <button type="submit" className="note-button" disabled={!excerpt}>引用到问答</button>
        <button type="button" className="note-button secondary" onClick={() => onSelect(makeScriptReference(version))}>询问脚本用途</button>
      </div>
    </form>}
  </section>;
}
