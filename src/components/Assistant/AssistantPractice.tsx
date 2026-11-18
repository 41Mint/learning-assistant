import { useMemo, useState } from 'react';
import { useCurrentGoalStore } from '../../store/currentGoalStore';
import { useGrowthStore } from '../../store/growthStore';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import { practiceHref, searchHref, workspaceResourceTarget } from '../../store/workspaceStore';
import { logLabel } from '../../utils/growth';
import { PRACTICE_REFERENCE_LABEL } from '../../utils/growthLabels';
import { codeVersionHref, codeVersionLabel, practiceCodeIds } from '../../utils/projectCode';
import { entrySearchFields, logSearchFields, matchesWords, searchWords } from '../../utils/resourceSearch';
import { matchScriptLine } from '../../utils/searchMatches';

export default function AssistantPractice({ query, onNavigate, active }: {
  query: string;
  onNavigate: () => void;
  active: boolean;
}) {
  const { outcomes, error } = useGrowthStore();
  const entries = useKnowledgeStore((state) => state.entries);
  const logs = useStudyLogStore((state) => state.logs);
  const { data: code, isLoaded: codeLoaded } = useProjectCodeStore();
  const { goal, setCurrentGoal } = useCurrentGoalStore();
  const [selected, setSelected] = useState<{ href: string; query: string }>();
  const [proposal, setProposal] = useState<{ href: string; label: string }>();
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const words = useMemo(() => searchWords(query), [query]);
  const matches = useMemo(() => {
    if (!active) return [];
    const logsById = new Map(logs.map((log) => [log.id, log]));
    const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
    const versionsById = new Map(code.versions.map((version) => [version.id, version]));
    const projectsById = new Map(code.projects.map((project) => [project.id, project.name]));
    return outcomes.flatMap((outcome) => outcome.practices.flatMap((practice) => {
      const relatedLogs = practice.logIds.flatMap((id) => logsById.get(id) ?? []);
      const relatedEntries = practice.entryIds.flatMap((id) => entriesById.get(id) ?? []);
      const relatedCode = practiceCodeIds(outcome.id, practice, code.links).flatMap((id) => versionsById.get(id) ?? []);
      const fields = [outcome.title, ...outcome.domains, practice.date, practice.note,
        ...relatedLogs.flatMap(logSearchFields), ...relatedEntries.flatMap(entrySearchFields),
        ...relatedCode.flatMap((version) => [version.path, version.note, projectsById.get(version.projectId) ?? '', version.content ?? ''])];
      if (!matchesWords(fields, words)) return [];
      return [{ outcome, practice, href: practiceHref(outcome.id, practice.id), relatedLogs, relatedEntries, relatedCode }];
    })).sort((a, b) => Number(matchesWords([b.outcome.title, b.practice.note], words))
      - Number(matchesWords([a.outcome.title, a.practice.note], words)) || b.practice.date.localeCompare(a.practice.date));
  }, [outcomes, logs, entries, code, words, active]);
  const current = selected?.query === query ? matches.find((item) => item.href === selected.href) : undefined;

  const link = (href: string, label: string, key = href) => {
    const target = workspaceResourceTarget(href);
    return <li key={key}><a href={href} {...target} onClick={(event) => {
      const latest = workspaceResourceTarget(href);
      event.currentTarget.target = latest.target ?? '';
      event.currentTarget.rel = latest.rel ?? '';
      if (!latest.target && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) onNavigate();
    }}>{label}</a></li>;
  };

  return <section className="assistant-practice" aria-label="回看实践">
    {current ? <>
      <button type="button" className="knowledge-text-button" onClick={() => { setSelected(undefined); setProposal(undefined); setNotice(undefined); }}>← 返回实践列表</button>
      <h3>{current.outcome.title}</h3>
      <p className="knowledge-muted">{[current.practice.date, ...current.outcome.domains].join(' · ')}</p>
      {current.practice.note && <p className="growth-note">{current.practice.note}</p>}
      <ul className="growth-source-list" aria-label="实践与关联资料">
        {link(current.href, '打开原实践')}
        {current.relatedLogs.map((log) => link('#history/' + log.date, `日志 · ${logLabel(log)}`))}
        {current.relatedEntries.map((entry) => link('#knowledge/' + encodeURIComponent(entry.id), `词条 · ${entry.title}`))}
        {current.relatedCode.map((version) => {
          const hit = version.content && words.length ? matchScriptLine(version.content, words) : undefined;
          const href = codeVersionHref(version.id);
          const project = code.projects.find((item) => item.id === version.projectId);
          const label = `代码 · ${codeVersionLabel(version, project?.name)}`;
          return link(hit ? searchHref(href, query, true) : href, hit ? `${label} · 第 ${hit.line} 行` : label, href);
        })}
      </ul>
      {!current.relatedLogs.length && !current.relatedEntries.length && !current.relatedCode.length &&
        <p className="knowledge-muted">{codeLoaded ? '这次实践暂无可打开的关联资料。' : '正在读取关联代码…'}</p>}
      {proposal?.href === current.href ? <form className="assistant-goal-form" onSubmit={(event) => {
        event.preventDefault();
        const label = proposal.label.trim();
        if (!label) return;
        try {
          setCurrentGoal({ type: 'practice', id: current.href, label });
          setNotice({ text: '已设为当前目标，可在今日学习查看。' });
          setProposal(undefined);
        } catch {
          setNotice({ text: '目标保存失败，请重试。', error: true });
        }
      }}>
        <label htmlFor="assistant-practice-goal">这次要做什么</label>
        <input id="assistant-practice-goal" className="search-input" value={proposal.label} maxLength={100}
          onChange={(event) => setProposal({ ...proposal, label: event.target.value })} />
        {goal && <p className="knowledge-muted">确认后将替换{goal.type === 'growth-card' ? PRACTICE_REFERENCE_LABEL : '当前学习目标'}「{goal.label}」。</p>}
        <div className="code-actions">
          <button type="submit" className="note-button" disabled={!proposal.label.trim()}>确认设定</button>
          <button type="button" className="note-button secondary" onClick={() => { setProposal(undefined); setNotice(undefined); }}>取消</button>
        </div>
      </form> : <button type="button" className="note-button secondary" onClick={() => {
        setProposal({ href: current.href, label: current.outcome.title.slice(0, 100) });
        setNotice(undefined);
      }}>设为当前目标</button>}
      {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    </> : <>
      {error ? <p role="alert">{error}</p> : <p className="knowledge-muted" role="status">
        {matches.length ? (words.length ? `找到 ${matches.length} 次实践` : '最近的实践')
          : words.length ? '没有找到匹配的实践。' : '还没有实践记录。'}
      </p>}
      <ul className="assistant-review-logs">{matches.slice(0, 8).map(({ outcome, practice, href }) => <li key={href}>
        <button type="button" onClick={() => { setSelected({ href, query }); setProposal(undefined); setNotice(undefined); }}>
          {outcome.title} · {practice.date}
        </button>
      </li>)}</ul>
      {matches.length > 8 && <p className="knowledge-muted">显示前 8 次，可补充关键词缩小范围。</p>}
    </>}
  </section>;
}
