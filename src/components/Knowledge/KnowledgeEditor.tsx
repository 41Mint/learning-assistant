import { useId, useRef, useState } from 'react';
import type { KnowledgeEntry } from '../../types';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import type { SaveKnowledgeEntry } from '../../store/knowledgeStore';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import { logLabel } from '../../utils/growth';
import { otherEntryId } from '../../utils/knowledge';
import { alignTrailingLogCitation, citedLogId, knowledgeLogCitation } from '../../utils/knowledgeLogCitation';
import { codeVersionLabel, entryCodeIds } from '../../utils/projectCode';
import { codeSearchFields, entrySearchFields, logSearchFields } from '../../utils/resourceSearch';
import FocusEditor from '../common/FocusEditor';
import MarkdownFields from '../common/MarkdownFields';
import type { MarkdownEditorHandle } from '../common/MarkdownFields';
import ReferenceChoices from '../common/ReferenceChoices';
import SearchableSelect from '../common/SearchableSelect';
import KnowledgeLogCitation from './KnowledgeLogCitation';

export default function KnowledgeEditor({ entry, categories, initialCategory, saveEntry: saveOverride, onSave, onCancel }: {
  entry?: KnowledgeEntry;
  categories: string[];
  initialCategory?: string;
  saveEntry?: SaveKnowledgeEntry;
  onSave: (id: string) => void;
  onCancel: () => void;
}) {
  const { entries, logLinks, relations, saveEntry } = useKnowledgeStore();
  const logs = useStudyLogStore((state) => state.logs);
  const { data: code, isLoaded: codeLoaded, error: codeError } = useProjectCodeStore();
  const [title, setTitle] = useState(entry?.title ?? '');
  const [aliases, setAliases] = useState(entry?.aliases.join('，') ?? '');
  const [category, setCategory] = useState(entry?.category ?? initialCategory ?? '');
  const [content, setContent] = useState(() => alignTrailingLogCitation(entry?.content ?? ''));
  const [logSelection, setLogSelection] = useState<string[] | null>(null);
  const [citationLogId, setCitationLogId] = useState('');
  const [entrySelection, setEntrySelection] = useState<string[] | null>(null);
  const [codeSelection, setCodeSelection] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const contentId = useId();
  const editor = useRef<MarkdownEditorHandle>(null);
  const current = entries.find((item) => item.id === entry?.id);
  const previousLogs = new Map(logLinks.filter((link) => link.entryId === entry?.id).map((link) => [link.logId, link.note]));
  const logIds = logSelection ?? [...previousLogs.keys()];
  const entryIds = entrySelection ?? (entry ? relations.flatMap((relation) => otherEntryId(relation, entry.id) ?? []) : []);
  const codeIds = codeSelection ?? (current ? entryCodeIds(current, [...code.links, ...code.trash.links]) : []);
  const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));

  const insertCitation = () => {
    if (!logs.some(({ id }) => id === citationLogId) || !editor.current?.insertAfterSelection(knowledgeLogCitation(citationLogId))) return;
    if (!logIds.includes(citationLogId)) setLogSelection([...logIds, citationLogId]);
  };

  const save = () => {
    try {
      const id = (saveOverride ?? saveEntry)({ title, aliases: aliases.split(/[,，\n]/), category, content }, {
        id: entry?.id,
        references: { logIds, entryIds, codeVersionIds: codeSelection ?? undefined },
      });
      onSave(id);
    } catch (error) {
      setError(error instanceof Error ? error.message : '词条保存失败，请重试。');
    }
  };

  return (
    <FocusEditor title={entry ? '编辑词条' : '新建词条'} description={entry ? entry.title : '填写名称后即可保存，正文与相关资料可逐步补充。'}
      formLabel="词条编辑表单" saveLabel="保存词条" cancelLabel="取消词条编辑" saveDisabled={!title.trim()}
      error={error} onSave={save} onCancel={onCancel}>
      <div className="entry-basics">
        <label>词条名称（必填）
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label>别名（用逗号分隔）
          <input value={aliases} onChange={(event) => setAliases(event.target.value)} />
        </label>
        <SearchableSelect label="分类（可选）" placeholder="选择或填写分类" allowCustomValue
          options={categories.filter(Boolean).map((item) => ({ id: item, label: item }))}
          value={category} onChange={setCategory} />
      </div>
      {sortedLogs.length > 0 && <div className="knowledge-citation-tools">
        <SearchableSelect label="引用学习日志" placeholder="按日期、标题、标签或正文筛选"
          options={sortedLogs.map((log) => ({ id: log.id, label: logLabel(log), fields: logSearchFields(log) }))}
          value={citationLogId} onChange={setCitationLogId} />
        <button type="button" className="workspace-button" disabled={!logs.some(({ id }) => id === citationLogId)}
          onClick={insertCitation}>插入引用</button>
      </div>}
      <MarkdownFields id={contentId} label="词条正文（Markdown）" previewLabel="词条正文预览" value={content}
        onChange={setContent} placeholder="我的理解、使用例子、仍有疑问…" editorRef={editor}
        renderLink={(href) => {
          const id = citedLogId(href);
          if (id !== undefined) return <KnowledgeLogCitation id={id} logIds={logIds} logs={logs} />;
        }} />
      <section className="growth-attachments" aria-label="关联资料（可选）">
        <h3>关联资料（可选）</h3>
        <p className="knowledge-muted">展开需要的类别，所选资料会随词条一起保存。</p>
        <ReferenceChoices title="关联学习日志" selected={logIds} onChange={setLogSelection}
          options={sortedLogs.map((log) => {
            const note = previousLogs.get(log.id);
            return { id: log.id, label: note ? logLabel(log) + ' · ' + note : logLabel(log), fields: logSearchFields(log) };
          })} />
        <ReferenceChoices title="关联其他词条" selected={entryIds} onChange={setEntrySelection}
          options={entries.filter((item) => item.id !== entry?.id).map((item) => ({ id: item.id, label: item.title, fields: entrySearchFields(item) }))} />
        {codeLoaded && !codeError ? (
          <ReferenceChoices title="关联代码版本" selected={codeIds} onChange={setCodeSelection}
            options={[...code.versions].reverse().map((version) => {
              const projectName = code.projects.find((project) => project.id === version.projectId)?.name ?? '';
              return { id: version.id, label: codeVersionLabel(version, projectName), fields: codeSearchFields(version, projectName) };
            })} emptyText="可先在学习日志或项目代码中保存一个版本。" />
        ) : <p className="knowledge-muted">{codeError || '正在读取可选的代码版本…'}</p>}
      </section>
    </FocusEditor>
  );
}
