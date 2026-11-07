import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { GROWTH_DOMAINS } from '../../data/growthPresets';
import { useGrowthStore } from '../../store/growthStore';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import type { GrowthOutcome, GrowthPractice } from '../../types';
import { logLabel } from '../../utils/growth';
import { generateId, getTodayDate } from '../../utils/storage';

export interface GrowthDraft {
  outcome: Omit<GrowthOutcome, 'practices'>;
  practice?: GrowthPractice;
  preset: boolean;
}

function toggleSelection<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

interface ReferenceChoicesProps {
  title: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

function ReferenceChoices({ title, options, selected, onChange }: ReferenceChoicesProps) {
  const unavailable = selected.filter((id) => !options.some((option) => option.id === id));
  return (
    <details className="growth-references">
      <summary>{title}（{selected.length}）</summary>
      <fieldset className="growth-options">
        <legend>{title}</legend>
        {options.length === 0 && unavailable.length === 0 && <p>暂无可选记录。</p>}
        {[...options, ...unavailable.map((id) => ({ id, label: '原记录已不可用' }))].map(({ id, label }) => (
          <label key={id}>
            <input type="checkbox" checked={selected.includes(id)} onChange={() => onChange(toggleSelection(selected, id))} />
            {label}
          </label>
        ))}
      </fieldset>
    </details>
  );
}

export default function GrowthPracticeForm({ draft, onClose }: { draft: GrowthDraft; onClose: (saved: boolean) => void }) {
  const [title, setTitle] = useState(draft.outcome.title);
  const [domains, setDomains] = useState(draft.outcome.domains);
  const [date, setDate] = useState(draft.practice?.date ?? getTodayDate);
  const [note, setNote] = useState(draft.practice?.note ?? '');
  const [logIds, setLogIds] = useState(draft.practice?.logIds ?? []);
  const [entryIds, setEntryIds] = useState(draft.practice?.entryIds ?? []);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const logs = useStudyLogStore((state) => state.logs);
  const entries = useKnowledgeStore((state) => state.entries);
  const savePractice = useGrowthStore((state) => state.savePractice);

  useEffect(() => {
    formRef.current?.scrollIntoView({ block: 'nearest' });
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      setError('请填写成果名称。');
      return;
    }
    try {
      savePractice(
        { id: draft.outcome.id, title: title.trim(), domains },
        { id: draft.practice?.id ?? generateId(), date, note: note.trim(), logIds, entryIds },
      );
      onClose(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存失败，请重试。');
    }
  };

  return (
    <form ref={formRef} className="growth-form" aria-label="实践记录表单" onSubmit={handleSubmit}>
      <h3>{draft.practice ? '编辑实践' : '记录实践'}</h3>
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
      <ReferenceChoices title="关联学习日志" options={[...logs].sort((a, b) => b.date.localeCompare(a.date)).map((log) => ({ id: log.id, label: logLabel(log) }))} selected={logIds} onChange={setLogIds} />
      <ReferenceChoices title="关联知识词条" options={entries.map((entry) => ({ id: entry.id, label: entry.title }))} selected={entryIds} onChange={setEntryIds} />
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="note-button">保存实践</button>
      <button type="button" className="note-button secondary" onClick={() => onClose(false)}>取消</button>
    </form>
  );
}
