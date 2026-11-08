import { useEffect, useRef, useState } from 'react';
import { GROWTH_DOMAINS, GROWTH_PRESETS } from '../../data/growthPresets';
import { useGrowthStore } from '../../store/growthStore';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import { practiceHref, useWorkspaceStore } from '../../store/workspaceStore';
import type { GrowthDomain, GrowthPractice } from '../../types';
import { logLabel } from '../../utils/growth';
import { codeVersionHref, codeVersionLabel, practiceCodeIds } from '../../utils/projectCode';
import { generateId } from '../../utils/storage';
import SkillTree from '../SkillTree/SkillTree';
import GrowthPracticeForm from './GrowthPracticeForm';
import type { GrowthDraft } from './GrowthPracticeForm';

function PracticeSources({ outcomeId, practice }: { outcomeId: string; practice: GrowthPractice }) {
  const logs = useStudyLogStore((state) => state.logs);
  const entries = useKnowledgeStore((state) => state.entries);
  const code = useProjectCodeStore((state) => state.data);
  const codeIds = practiceCodeIds(outcomeId, practice, code.links);
  if (practice.logIds.length === 0 && practice.entryIds.length === 0 && codeIds.length === 0) return null;

  return (
    <ul className="growth-source-list" aria-label="关联资料">
      {practice.logIds.map((id) => {
        const log = logs.find((item) => item.id === id);
        return <li key={id}>{log ? <a href={`#history/${log.date}`}>{logLabel(log)}</a> : '关联日志已不可用'}</li>;
      })}
      {practice.entryIds.map((id) => {
        const entry = entries.find((item) => item.id === id);
        return <li key={id}>{entry ? <a href={`#knowledge/${encodeURIComponent(id)}`}>{entry.title}</a> : '关联词条已不可用'}</li>;
      })}
      {codeIds.map((id) => {
        const version = code.versions.find((item) => item.id === id);
        const project = version && code.projects.find((item) => item.id === version.projectId);
        return (
          <li key={id}>
            {version
              ? <a href={codeVersionHref(id)} title={codeVersionLabel(version, project?.name)}>代码 · {version.path}</a>
              : '关联代码已不可用'}
          </li>
        );
      })}
    </ul>
  );
}

export default function GrowthWorkspace() {
  const { outcomes, isLoaded, error, loadGrowth, removePractice } = useGrowthStore();
  const [domain, setDomain] = useState<GrowthDomain | ''>('');
  const [draft, setDraft] = useState<GrowthDraft | null>(null);
  const [notice, setNotice] = useState<{ text: string; saved?: { outcomeId: string; id: string } } | null>(null);
  const practiceTarget = useWorkspaceStore((state) => state.practiceTarget);
  const focusedPractice = useRef<HTMLLIElement>(null);
  const editorTrigger = useRef<HTMLButtonElement>(null);
  const selectedDomain = practiceTarget ? '' : domain;

  useEffect(() => { loadGrowth(); }, [loadGrowth]);
  useEffect(() => {
    if (!practiceTarget || !isLoaded) return;
    const frame = window.requestAnimationFrame(() => {
      focusedPractice.current?.focus({ preventScroll: true });
      focusedPractice.current?.scrollIntoView({ block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [practiceTarget, isLoaded]);

  const visibleOutcomes = outcomes
    .filter((outcome) => !selectedDomain || outcome.domains.includes(selectedDomain))
    .map((outcome) => ({ ...outcome, practices: [...outcome.practices].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)) }))
    .sort((a, b) => b.practices[0].date.localeCompare(a.practices[0].date) || b.practices[0].id.localeCompare(a.practices[0].id));
  const visiblePresets = GROWTH_PRESETS.filter((preset) => !selectedDomain || preset.domains.includes(selectedDomain));
  const canOpenForm = isLoaded && !error && !draft;

  const begin = (next: GrowthDraft, trigger: HTMLButtonElement) => {
    editorTrigger.current = trigger;
    setDraft(next);
    setNotice(null);
  };

  const closeEditor = (savedId?: string) => {
    if (!draft) return;
    const outcomeId = draft.outcome.id;
    setDraft(null);
    if (savedId) {
      setDomain('');
      setNotice({ text: '实践已保存。', saved: { outcomeId, id: savedId } });
      const href = practiceHref(outcomeId, savedId);
      if (window.location.hash !== href) window.location.hash = href;
      else window.requestAnimationFrame(() => focusedPractice.current?.focus());
    } else {
      window.requestAnimationFrame(() => editorTrigger.current?.focus());
    }
  };

  const remove = (outcomeId: string, practiceId: string, isLast: boolean) => {
    const prompt = isLast ? '删除最后一次实践后，这项成果会从成长记录移除。确定删除？' : '确定删除这次实践？';
    if (!window.confirm(prompt)) return;
    try {
      removePractice(outcomeId, practiceId);
      setNotice({ text: '已删除实践。' });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : '删除失败，请重试。' });
    }
  };

  return (
    <div className="growth-workspace">
      {draft && (
        <section className="module-card growth-editor" aria-label="实践编辑">
          <GrowthPracticeForm draft={draft} onClose={closeEditor} />
        </section>
      )}
      <section className="module-card" aria-label="最近做到" hidden={Boolean(draft)}>
        <div className="growth-heading">
          <div>
            <h2>最近做到</h2>
            <p className="growth-muted">做完一件事后，留下这次实践。以后换个情境再做，可以接着记录。</p>
          </div>
          <div className="code-actions">
            <a href="#code">项目代码</a>
            <button type="button" className="note-button" disabled={!canOpenForm} onClick={(event) => begin({
              outcome: { id: generateId(), title: '', domains: selectedDomain ? [selectedDomain] : [] }, preset: false,
            }, event.currentTarget)}>记录自定义成果</button>
          </div>
        </div>
        <label className="growth-filter">按领域筛选
          <select value={selectedDomain} onChange={(event) => {
            setDomain(event.target.value as GrowthDomain | '');
            if (practiceTarget) window.location.hash = 'path';
          }}>
            <option value="">全部领域</option>
            {GROWTH_DOMAINS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        {error && <p role="alert">{error}</p>}
        {notice && !notice.saved && <p role="status">{notice.text}</p>}
        {isLoaded && !error && visibleOutcomes.length === 0 && (
          <p className="growth-muted">{selectedDomain ? '这个领域暂时没有成果记录。' : '还没有成果记录。可以打开“可以尝试”，或记录一件自己做成的事。'}</p>
        )}
        <div className="growth-results">
          {visibleOutcomes.map((outcome) => {
            const preset = GROWTH_PRESETS.some((item) => item.id === outcome.id);
            return (
              <article key={outcome.id} className="growth-card" aria-label={outcome.title}>
                <div className="growth-heading">
                  <div>
                    <h3>{outcome.title}</h3>
                    <p className="growth-muted">{[...outcome.domains, `${outcome.practices.length} 次实践`].join(' · ')}</p>
                  </div>
                  <button type="button" className="note-button secondary" disabled={!canOpenForm} onClick={(event) => begin({ outcome, preset }, event.currentTarget)}>追加实践</button>
                </div>
                <ol className="growth-practices">
                  {outcome.practices.map((practice) => {
                    const focused = practiceTarget?.outcomeId === outcome.id && practiceTarget.practiceId === practice.id;
                    return (
                      <li key={practice.id} ref={focused ? focusedPractice : undefined} tabIndex={focused ? -1 : undefined} data-practice-focus={focused || undefined}>
                        <div className="growth-heading">
                          <div>
                            <time dateTime={practice.date}>{practice.date}</time>
                            {notice?.saved?.outcomeId === outcome.id && notice.saved.id === practice.id && (
                              <span className="growth-save-status" role="status">{notice.text}</span>
                            )}
                          </div>
                          <div>
                            <button type="button" className="knowledge-text-button" disabled={!canOpenForm} onClick={(event) => begin({ outcome, preset, practice }, event.currentTarget)}>编辑实践</button>
                            <button type="button" className="knowledge-text-button danger" disabled={!canOpenForm} onClick={() => remove(outcome.id, practice.id, outcome.practices.length === 1)}>删除实践</button>
                          </div>
                        </div>
                        {practice.note && <p className="growth-note">{practice.note}</p>}
                        <PracticeSources outcomeId={outcome.id} practice={practice} />
                      </li>
                    );
                  })}
                </ol>
              </article>
            );
          })}
        </div>
      </section>

      <details className="module-card growth-directory" hidden={Boolean(draft)}>
        <summary>可以尝试</summary>
        <p className="growth-muted">从符合你实际经历的成果开始，也可以把这里当作练习参考。</p>
        {visiblePresets.length === 0 && <p>这个领域暂无预设成果，可以记录自定义成果。</p>}
        <div className="growth-preset-grid">
          {visiblePresets.map(({ id, title, domains, cue }) => {
            const existing = outcomes.find((outcome) => outcome.id === id);
            return (
              <article key={id} className="growth-card" aria-label={title}>
                <h3>{title}</h3>
                <p className="growth-muted">{domains.join(' · ')}</p>
                <p>{cue}</p>
                <button type="button" className="note-button secondary" disabled={!canOpenForm}
                  onClick={(event) => begin({ outcome: existing ?? { id, title, domains }, preset: true }, event.currentTarget)}>
                  {existing ? '追加实践' : '我做到了'}
                </button>
              </article>
            );
          })}
        </div>
      </details>

      <details className="module-card growth-directory" hidden={Boolean(draft)}>
        <summary>参考路径与任务</summary>
        <SkillTree />
      </details>
    </div>
  );
}
