import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useCurrentGoalStore } from '../../store/currentGoalStore';
import { useGrowthStore } from '../../store/growthStore';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import { searchHref } from '../../store/workspaceStore';
import { PRACTICE_REVIEW_GOAL_LIMIT } from '../../types/practiceReview';
import type { PracticeReviewResult } from '../../types/practiceReview';
import { logLabel } from '../../utils/growth';
import { PRACTICE_REFERENCE_LABEL } from '../../utils/growthLabels';
import { practiceReviewSources, practiceSourceLookup, requestPracticeReview } from '../../utils/practiceReview';
import type { PracticeSelection } from '../../utils/practiceReview';
import { evidenceLabels } from '../../utils/assistantEvidence';
import type { EvidenceLink } from '../../utils/assistantEvidence';
import { codeVersionHref, codeVersionLabel } from '../../utils/projectCode';
import { searchWords } from '../../utils/resourceSearch';
import { matchScriptLine } from '../../utils/searchMatches';
import AssistantSourceLink from './AssistantSourceLink';

type ReviewState =
  | { status: 'pending' }
  | { status: 'complete'; result: PracticeReviewResult; sources: EvidenceLink[] }
  | { status: 'failed'; error: string };

export default function AssistantPractice({ selection, query, onNavigate }: {
  selection: PracticeSelection;
  query: string;
  onNavigate: () => void;
}) {
  const outcome = useGrowthStore((state) => state.outcomes.find(({ id }) => id === selection.outcomeId));
  const entries = useKnowledgeStore((state) => state.entries);
  const logs = useStudyLogStore((state) => state.logs);
  const { data: code, isLoaded: codeLoaded } = useProjectCodeStore();
  const { goal, setCurrentGoal } = useCurrentGoalStore();
  const [proposal, setProposal] = useState<{ href: string; label: string }>();
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const [review, setReview] = useState<ReviewState>();
  const reviewRequest = useRef<AbortController>(null);
  const goalAction = useRef<HTMLButtonElement>(null);
  const goalInputId = useId();
  useEffect(() => () => reviewRequest.current?.abort(), []);
  const words = useMemo(() => searchWords(query), [query]);
  const current = useMemo(() => {
    const practice = outcome?.practices.find(({ id }) => id === selection.practiceId);
    return outcome && practice ? practiceSourceLookup(logs, entries, code)(outcome, practice) : undefined;
  }, [outcome, selection.practiceId, logs, entries, code]);
  const sources = useMemo(() => current ? practiceReviewSources(current, words, code.projects) : [], [current, words, code.projects]);
  const hasEvidence = sources.some(({ excerpt }) => excerpt.length > 0);
  const complete = review?.status === 'complete' ? review : undefined;
  const suggestedGoal = complete?.result.nextStep;
  const editingGoal = proposal && proposal.href === current?.href ? proposal : undefined;

  const cancelReview = () => {
    reviewRequest.current?.abort();
    reviewRequest.current = null;
    setReview(undefined);
  };
  const generateReview = async () => {
    if (!codeLoaded || !hasEvidence || reviewRequest.current) return;
    const controller = new AbortController();
    reviewRequest.current = controller;
    setReview({ status: 'pending' });
    try {
      const result = await requestPracticeReview(sources, controller.signal);
      if (!controller.signal.aborted) setReview({ status: 'complete', result, sources });
    } catch (error) {
      if (!controller.signal.aborted) setReview({ status: 'failed', error: error instanceof Error ? error.message : '暂时无法复盘，请重试。' });
    } finally {
      if (reviewRequest.current === controller) reviewRequest.current = null;
    }
  };
  const proposeGoal = (href: string, label: string) => {
    setProposal({ href, label: label.slice(0, PRACTICE_REVIEW_GOAL_LIMIT) });
    setNotice(undefined);
  };
  const dismissGoal = () => {
    setProposal(undefined);
    requestAnimationFrame(() => goalAction.current?.focus({ preventScroll: true }));
  };

  const link = (href: string, label: string, key = href) => <li key={key}>
    <AssistantSourceLink href={href} label={label} onNavigate={onNavigate} />
  </li>;

  return <section className="assistant-practice" aria-label="所选实践">
    {current ? <>
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
      <section className="assistant-evidence-panel" aria-label="实践复盘">
        {review?.status === 'pending' && <p role="status">正在复盘这次实践…</p>}
        {review?.status === 'failed' && <p role="alert">{review.error}</p>}
        {complete ? <>
          {[
            { label: '上次做法', finding: complete.result.approach, empty: '本次摘录缺少可核对的做法。' },
            { label: '验证情况', finding: complete.result.verification, empty: '本次摘录缺少验证动作或实际结果。' },
          ].map(({ label, finding, empty }) => {
            const source = finding && complete.sources[finding.source - 1];
            return <div className="assistant-evidence-finding" key={label}>
              <h4>{label}</h4>
              {finding && source ? <>
                <p>{finding.text}</p>
                <blockquote className="knowledge-muted">{finding.quote}</blockquote>
                <ul className="growth-source-list" aria-label={`${label}来源`}>
                  {link(source.href, `${evidenceLabels[source.kind]} · ${source.title}`)}
                </ul>
              </> : <p className="knowledge-muted">{empty}</p>}
            </div>;
          })}
          {complete.result.missing && <p><strong>待确认</strong>　{complete.result.missing}</p>}
          {suggestedGoal && <div className="assistant-evidence-finding">
            <h4>可以试的下一步</h4>
            <p>{suggestedGoal}</p>
          </div>}
        </> : review?.status !== 'pending' && <p className="knowledge-muted">{codeLoaded && !hasEvidence
          ? '补充实践备注或关联资料后可生成复盘。' : '复盘会把这次实践和关联资料的摘录发送给 DeepSeek。'}</p>}
        <div className="code-actions" role="group" aria-label="实践复盘操作">
          {suggestedGoal && !editingGoal && <button ref={goalAction} type="button" className="note-button"
            onClick={() => proposeGoal(current.href, suggestedGoal)}>用作当前目标</button>}
          {review?.status === 'pending' ? <button type="button" className="note-button secondary" onClick={cancelReview}>停止复盘</button>
            : (!codeLoaded || hasEvidence) && <button type="button" className={suggestedGoal ? 'note-button secondary' : 'note-button'}
              disabled={!codeLoaded} onClick={() => void generateReview()}>
              {review?.status === 'failed' ? '重试复盘' : complete ? '重新复盘' : '复盘这次实践'}
            </button>}
          {!suggestedGoal && !editingGoal && <button ref={goalAction} type="button" className="note-button secondary"
            onClick={() => proposeGoal(current.href, current.outcome.title)}>设为当前目标</button>}
        </div>
      </section>
      {editingGoal && <form className="assistant-goal-form" onSubmit={(event) => {
        event.preventDefault();
        const label = editingGoal.label.trim();
        if (!label) return;
        try {
          setCurrentGoal({ type: 'practice', id: current.href, label });
          setNotice({ text: '已设为当前目标，可在今日学习查看。' });
          dismissGoal();
        } catch {
          setNotice({ text: '目标保存失败，请重试。', error: true });
        }
      }}>
        <label htmlFor={goalInputId}>这次要做什么</label>
        <input id={goalInputId} className="search-input" autoFocus value={editingGoal.label} maxLength={PRACTICE_REVIEW_GOAL_LIMIT}
          onChange={(event) => setProposal({ ...editingGoal, label: event.target.value })} />
        {goal && <p className="knowledge-muted">确认后将替换{goal.type === 'growth-card' ? PRACTICE_REFERENCE_LABEL : '当前学习目标'}「{goal.label}」。</p>}
        <div className="code-actions">
          <button type="submit" className="note-button" disabled={!editingGoal.label.trim()}>确认设定</button>
          <button type="button" className="note-button secondary" onClick={() => { dismissGoal(); setNotice(undefined); }}>取消</button>
        </div>
      </form>}
      {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    </> : <p role="status" className="knowledge-muted">这条实践已不可用。</p>}
  </section>;
}
