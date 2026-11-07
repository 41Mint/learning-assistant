import { useEffect, useState } from 'react';
import { GROWTH_DOMAINS, GROWTH_PRESETS } from '../../data/growthPresets';
import { useGrowthStore } from '../../store/growthStore';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import type { GrowthDomain, GrowthPractice } from '../../types';
import { logLabel } from '../../utils/growth';
import { generateId } from '../../utils/storage';
import SkillTree from '../SkillTree/SkillTree';
import GrowthPracticeForm from './GrowthPracticeForm';
import type { GrowthDraft } from './GrowthPracticeForm';

function PracticeSources({ practice }: { practice: GrowthPractice }) {
  const logs = useStudyLogStore((state) => state.logs);
  const entries = useKnowledgeStore((state) => state.entries);
  if (practice.logIds.length === 0 && practice.entryIds.length === 0) return null;

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
    </ul>
  );
}

export default function GrowthWorkspace() {
  const { outcomes, isLoaded, error, loadGrowth, removePractice } = useGrowthStore();
  const [domain, setDomain] = useState<GrowthDomain | ''>('');
  const [draft, setDraft] = useState<GrowthDraft | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => { loadGrowth(); }, [loadGrowth]);

  const visibleOutcomes = outcomes
    .filter((outcome) => !domain || outcome.domains.includes(domain))
    .map((outcome) => ({ ...outcome, practices: [...outcome.practices].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)) }))
    .sort((a, b) => b.practices[0].date.localeCompare(a.practices[0].date) || b.practices[0].id.localeCompare(a.practices[0].id));
  const visiblePresets = GROWTH_PRESETS.filter((preset) => !domain || preset.domains.includes(domain));
  const canOpenForm = isLoaded && !error && !draft;

  const begin = (next: GrowthDraft) => {
    setDraft(next);
    setNotice('');
  };

  const remove = (outcomeId: string, practiceId: string, isLast: boolean) => {
    const prompt = isLast ? '删除最后一次实践后，这项成果会从成长记录移除。确定删除？' : '确定删除这次实践？';
    if (!window.confirm(prompt)) return;
    try {
      removePractice(outcomeId, practiceId);
      setNotice('已删除实践。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '删除失败，请重试。');
    }
  };

  return (
    <div className="growth-workspace">
      <section className="module-card" aria-label="最近做到">
        <div className="growth-heading">
          <div>
            <h2>最近做到</h2>
            <p className="growth-muted">做完一件事后，留下这次实践。以后换个情境再做，可以接着记录。</p>
          </div>
          <button type="button" className="note-button" disabled={!canOpenForm} onClick={() => begin({
            outcome: { id: generateId(), title: '', domains: domain ? [domain] : [] }, preset: false,
          })}>记录自定义成果</button>
        </div>
        <label className="growth-filter">按领域筛选
          <select value={domain} onChange={(event) => setDomain(event.target.value as GrowthDomain | '')}>
            <option value="">全部领域</option>
            {GROWTH_DOMAINS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        {error && <p role="alert">{error}</p>}
        {draft && <GrowthPracticeForm draft={draft} onClose={(saved) => {
          setDraft(null);
          if (saved) {
            setDomain('');
            setNotice('实践已保存。');
          }
        }} />}
        {notice && <p role="status">{notice}</p>}
        {isLoaded && !error && visibleOutcomes.length === 0 && (
          <p className="growth-muted">{domain ? '这个领域暂时没有成果记录。' : '还没有成果记录。可以打开“可以尝试”，或记录一件自己做成的事。'}</p>
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
                  <button type="button" className="note-button secondary" disabled={!canOpenForm} onClick={() => begin({ outcome, preset })}>追加实践</button>
                </div>
                <ol className="growth-practices">
                  {outcome.practices.map((practice) => (
                    <li key={practice.id}>
                      <div className="growth-heading">
                        <time dateTime={practice.date}>{practice.date}</time>
                        <div>
                          <button type="button" className="knowledge-text-button" disabled={!canOpenForm} onClick={() => begin({ outcome, preset, practice })}>编辑实践</button>
                          <button type="button" className="knowledge-text-button danger" disabled={!canOpenForm} onClick={() => remove(outcome.id, practice.id, outcome.practices.length === 1)}>删除实践</button>
                        </div>
                      </div>
                      {practice.note && <p className="growth-note">{practice.note}</p>}
                      <PracticeSources practice={practice} />
                    </li>
                  ))}
                </ol>
              </article>
            );
          })}
        </div>
      </section>

      <details className="module-card growth-directory">
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
                  onClick={() => begin({ outcome: existing ?? { id, title, domains }, preset: true })}>
                  {existing ? '追加实践' : '我做到了'}
                </button>
              </article>
            );
          })}
        </div>
      </details>

      <details className="module-card growth-directory">
        <summary>参考路径与任务</summary>
        <SkillTree />
      </details>
    </div>
  );
}
