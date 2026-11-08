import { useState } from 'react';
import { GROWTH_DOMAINS } from '../../data/growthPresets';
import { useGrowthStore } from '../../store/growthStore';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import type { GrowthOutcome, GrowthPractice } from '../../types';
import { logLabel } from '../../utils/growth';
import { codeVersionLabel, practiceCodeIds } from '../../utils/projectCode';
import { codeSearchFields, entrySearchFields, logSearchFields } from '../../utils/resourceSearch';
import { generateId, getTodayDate } from '../../utils/storage';
import FocusEditor from '../common/FocusEditor';
import ReferenceChoices from '../common/ReferenceChoices';

export interface GrowthDraft {
  outcome: Omit<GrowthOutcome, 'practices'>;
  practice?: GrowthPractice;
  preset: boolean;
}

function toggleSelection<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export default function GrowthPracticeForm({ draft, onClose }: { draft: GrowthDraft; onClose: (savedId?: string) => void }) {
  const [title, setTitle] = useState(draft.outcome.title);
  const [domains, setDomains] = useState(draft.outcome.domains);
  const [date, setDate] = useState(draft.practice?.date ?? getTodayDate);
  const [note, setNote] = useState(draft.practice?.note ?? '');
  const [logIds, setLogIds] = useState(draft.practice?.logIds ?? []);
  const [entryIds, setEntryIds] = useState(draft.practice?.entryIds ?? []);
  const [codeSelection, setCodeSelection] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const logs = useStudyLogStore((state) => state.logs);
  const entries = useKnowledgeStore((state) => state.entries);
  const savePractice = useGrowthStore((state) => state.savePractice);
  const { data: projectCode, isLoaded: codeLoaded, error: codeError } = useProjectCodeStore();
  const codeIds = codeSelection ?? (draft.practice ? practiceCodeIds(draft.outcome.id, draft.practice, projectCode.links) : []);
  const codeOptions = [...projectCode.versions].reverse().map((version) => {
    const projectName = projectCode.projects.find((project) => project.id === version.projectId)?.name ?? '';
    return { id: version.id, label: codeVersionLabel(version, projectName), fields: codeSearchFields(version, projectName) };
  });

  const handleSubmit = () => {
    if (!title.trim()) {
      setError('请填写成果名称。');
      return;
    }
    try {
      const id = draft.practice?.id ?? generateId();
      const codeVersionIds = codeSelection ?? draft.practice?.codeVersionIds;
      savePractice(
        { id: draft.outcome.id, title: title.trim(), domains },
        { id, date, note: note.trim(), logIds, entryIds, codeVersionIds },
      );
      onClose(id);
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存失败，请重试。');
    }
  };

  return (
    <FocusEditor title={draft.practice ? '编辑实践' : '记录实践'}
      description={draft.practice ? draft.outcome.title + ' · ' + draft.practice.date : '填写这次实践，按需选择相关资料。'}
      formLabel="实践记录表单" saveLabel="保存实践" cancelLabel="取消" error={error}
      onSave={handleSubmit} onCancel={() => onClose()}>
      {draft.preset ? (
        <p><strong>{title}</strong> <span className="growth-muted">{domains.join(' · ')}</span></p>
      ) : (
        <>
          <label className="growth-field">成果名称
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <fieldset className="growth-domains">
            <legend>领域（可选）</legend>
            {GROWTH_DOMAINS.map((domain) => (
              <label key={domain}>
                <input type="checkbox" checked={domains.includes(domain)} onChange={() => setDomains(toggleSelection(domains, domain))} />
                {domain}
              </label>
            ))}
          </fieldset>
        </>
      )}
      <label className="growth-field">实践日期
        <input type="date" value={date} max={getTodayDate()} onChange={(event) => setDate(event.target.value)} required />
      </label>
      <label className="growth-field">这次做了什么（可选）
        <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：跟着教程实现移动，自己调整了速度。" />
      </label>
      <section className="growth-attachments" aria-label="关联资料（可选）">
        <h3>关联资料（可选）</h3>
        <p className="growth-muted">展开需要的类别，所选资料会随这次实践一起保存。</p>
        <ReferenceChoices title="关联学习日志" options={[...logs].sort((a, b) => b.date.localeCompare(a.date)).map((log) => ({ id: log.id, label: logLabel(log), fields: logSearchFields(log) }))} selected={logIds} onChange={setLogIds} />
        <ReferenceChoices title="关联知识词条" options={entries.map((entry) => ({ id: entry.id, label: entry.title, fields: entrySearchFields(entry) }))} selected={entryIds} onChange={setEntryIds} />
        {codeLoaded && !codeError ? (
          <ReferenceChoices title="关联代码版本" options={codeOptions} selected={codeIds} onChange={setCodeSelection}
            emptyText="可先在学习日志或项目代码中保存一个版本。" />
        ) : <p className="growth-muted">{codeError || '正在读取可选的代码版本…'}</p>}
      </section>
    </FocusEditor>
  );
}
