import { useContext, useEffect, useRef, useState } from 'react';
import { GROWTH_DOMAINS, GROWTH_PRESETS } from '../../data/growthPresets';
import { useGrowthStore } from '../../store/growthStore';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import { exerciseHref, growthBoardHref, GROWTH_VIEWS, practiceHref, useWorkspaceStore, workspaceResourceTarget } from '../../store/workspaceStore';
import type { GrowthDomain, GrowthOutcome, GrowthPractice, SavedExercise } from '../../types';
import { growthExercises, logLabel } from '../../utils/growth';
import { codeVersionHref, codeVersionLabel, practiceCodeIds } from '../../utils/projectCode';
import { generateId } from '../../utils/storage';
import SkillTree from '../SkillTree/SkillTree';
import GrowthPracticeForm from './GrowthPracticeForm';
import GrowthExerciseForm from './GrowthExerciseForm';
import type { GrowthExerciseDraft } from './GrowthExerciseForm';
import GrowthCard from './GrowthCard';
import GrowthBoardDialog from './GrowthBoardDialog';
import type { GrowthCardAction } from './GrowthCard';
import type { GrowthDraft } from './GrowthPracticeForm';
import { AssistantSlots } from '../Assistant/assistantSlots';

type SourceIds = Pick<GrowthPractice, 'logIds' | 'entryIds' | 'codeVersionIds'>;
function PracticeSources({ outcomeId, practice }: { outcomeId?: string; practice: SourceIds & { id?: string } }) {
  const logs = useStudyLogStore((state) => state.logs);
  const entries = useKnowledgeStore((state) => state.entries);
  const code = useProjectCodeStore((state) => state.data);
  const codeIds = outcomeId && practice.id ? practiceCodeIds(outcomeId, { ...practice, id: practice.id }, code.links) : practice.codeVersionIds ?? [];
  if (practice.logIds.length === 0 && practice.entryIds.length === 0 && codeIds.length === 0) return null;

  return (
    <ul className="growth-source-list" aria-label="关联资料">
      {practice.logIds.map((id) => {
        const log = logs.find((item) => item.id === id);
        const href = log && `#history/${log.date}`;
        return <li key={`log:${id}`}>{log && href ? <a href={href} {...workspaceResourceTarget(href)}>{logLabel(log)}</a> : '关联日志已不可用'}</li>;
      })}
      {practice.entryIds.map((id) => {
        const entry = entries.find((item) => item.id === id);
        const href = `#knowledge/${encodeURIComponent(id)}`;
        return <li key={`entry:${id}`}>{entry ? <a href={href} {...workspaceResourceTarget(href)}>{entry.title}</a> : '关联词条已不可用'}</li>;
      })}
      {codeIds.map((id) => {
        const version = code.versions.find((item) => item.id === id);
        const project = version && code.projects.find((item) => item.id === version.projectId);
        return (
          <li key={`code:${id}`}>
            {version
              ? <a href={codeVersionHref(id)} {...workspaceResourceTarget(codeVersionHref(id))} title={codeVersionLabel(version, project?.name)}>代码 · {version.path}</a>
              : '关联代码已不可用'}
          </li>
        );
      })}
    </ul>
  );
}

export default function GrowthWorkspace({ active, draft, setDraft, exerciseDraft, setExerciseDraft }: {
  active: boolean;
  draft: GrowthDraft | null;
  setDraft: (draft: GrowthDraft | null) => void;
  exerciseDraft?: GrowthExerciseDraft;
  setExerciseDraft: (draft?: GrowthExerciseDraft) => void;
}) {
  const { outcomes, exercises, hiddenPresetIds, groups, isLoaded, error, loadGrowth, removePractice, removeExercise, restorePreset, saveGroup, removeGroup, moveCard } = useGrowthStore();
  const [domain, setDomain] = useState<GrowthDomain | ''>('');
  const activeView = useWorkspaceStore((state) => state.growthView);
  const { openGrowthRecommendations } = useContext(AssistantSlots);
  const [notice, setNotice] = useState<{ text: string; saved: { outcomeId: string; id: string } } | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean }>();
  const [dialog, setDialog] = useState<{ kind: 'group' | 'move' | 'edit' | 'delete' | 'restore'; id?: string; trigger?: HTMLButtonElement; practiceId?: string }>();
  const addMenu = useRef<HTMLDivElement>(null);
  const addTrigger = useRef<HTMLButtonElement>(null);
  const exerciseTrigger = useRef<HTMLElement>(null);
  const [selection, setSelection] = useState('');
  const groupId = useWorkspaceStore((state) => state.growthGroupId);
  const cardId = useWorkspaceStore((state) => state.growthCardId);
  const exerciseId = useWorkspaceStore((state) => state.growthExerciseId);
  const group = groups.find(({ id }) => id === groupId);
  const practiceTarget = useWorkspaceStore((state) => state.practiceTarget);
  const outcomeId = useWorkspaceStore((state) => state.growthOutcomeId);
  const focusedPractice = useRef<HTMLLIElement>(null);
  const focusedOutcome = useRef<HTMLHeadingElement>(null);
  const editorTrigger = useRef<HTMLButtonElement>(null);
  const selectedDomain = outcomeId || cardId || exerciseId ? '' : domain;

  useEffect(() => { loadGrowth(); }, [loadGrowth]);
  useEffect(() => {
    if (!feedback || feedback.error) return;
    const timer = window.setTimeout(() => setFeedback(undefined), 3000);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  useEffect(() => {
    if ((!outcomeId && !exerciseId) || !isLoaded || !active) return;
    const frame = window.requestAnimationFrame(() => {
      const target = focusedPractice.current ?? focusedOutcome.current;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active, exerciseId, outcomeId, practiceTarget, isLoaded]);

  const visibleOutcomes = outcomes
    .filter((outcome) => !selectedDomain || outcome.domains.includes(selectedDomain))
    .map((outcome) => ({ ...outcome, practices: [...outcome.practices].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)) }))
    .sort((a, b) => b.practices[0].date.localeCompare(a.practices[0].date) || b.practices[0].id.localeCompare(a.practices[0].id));
  const completedIds = new Set(outcomes.map((outcome) => outcome.id));
  const exercisesById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const activeOutcome = visibleOutcomes.find(({ id }) => id === outcomeId);
  const activePreset = GROWTH_PRESETS.find((item) => item.id === activeOutcome?.id);
  const activeExercise = activeOutcome && exercisesById.get(activeOutcome.id);
  const activeDescription = activeOutcome?.description ?? activeExercise?.action ?? activePreset?.cue;
  const canOpenForm = isLoaded && !error && !draft && !exerciseDraft;
  const boardView = activeView === 'topics' ? 'recent' : activeView;
  const boardHref = growthBoardHref(boardView, group?.id);
  const cardInGroup = (id: string) => !group || group.cardIds.includes(id);
  const completedCards = visibleOutcomes.filter(({ id }) => cardInGroup(id));
  const pendingCards = growthExercises({ exercises, hiddenPresetIds })
    .filter(({ id, domains }) => !completedIds.has(id) && cardInGroup(id) && (!selectedDomain || domains.includes(selectedDomain)));
  const activeExerciseDetails = pendingCards.find(({ id }) => id === exerciseId);

  const editExercise = (trigger: HTMLElement, exercise?: SavedExercise) => {
    exerciseTrigger.current = trigger;
    setExerciseDraft({ creating: !exercise, groupId: exercise ? undefined : group?.id, exercise: exercise ?? {
      id: generateId(), title: '', domains: domain ? [domain] : [], action: '', done: '',
      sources: { logIds: [], entryIds: [], codeVersionIds: [] },
    } });
  };
  const recordExercise = (exercise: SavedExercise, trigger: HTMLButtonElement) => {
    begin({ outcome: { id: exercise.id, title: exercise.title, domains: exercise.domains, description: exercise.action },
      preset: GROWTH_PRESETS.some(({ id }) => id === exercise.id), suggestedSources: exercise.sources }, trigger);
  };

  const begin = (next: GrowthDraft, trigger: HTMLButtonElement) => {
    editorTrigger.current = trigger;
    setDialog(undefined);
    setDraft(next);
    setNotice(null);
    setFeedback(undefined);
  };

  const closeEditor = (savedId?: string) => {
    if (!draft) return;
    const outcomeId = draft.outcome.id;
    setDraft(null);
    if (savedId) {
      setDomain('');
      setNotice({ text: '实践已保存。', saved: { outcomeId, id: savedId } });
      const href = practiceHref(outcomeId, savedId) + (group ? '?' + new URLSearchParams({ group: group.id }) : '');
      if (window.location.hash !== href) window.location.assign(href);
      else window.requestAnimationFrame(() => focusedPractice.current?.focus());
    } else {
      window.requestAnimationFrame(() => editorTrigger.current?.focus());
    }
  };

  const choosePractice = (kind: 'edit' | 'delete', outcome: GrowthOutcome, trigger: HTMLButtonElement, practice?: GrowthPractice) => {
    if (kind === 'edit' && outcome.practices.length === 1) {
      begin({ outcome, preset: GROWTH_PRESETS.some(({ id }) => id === outcome.id), practice: outcome.practices[0] }, trigger);
      return;
    }
    setSelection((practice ?? outcome.practices[0]).id);
    setDialog({ kind, id: outcome.id, trigger, practiceId: practice?.id });
  };
  const moveAction = (id: string): GrowthCardAction => ({ label: '移到卡组', run: canOpenForm ? (trigger) => {
    setSelection(groups.find(({ cardIds }) => cardIds.includes(id))?.id ?? '');
    setDialog({ kind: 'move', id, trigger });
  } : undefined });
  const dialogOutcome = visibleOutcomes.find(({ id }) => id === dialog?.id);
  const dialogPractice = dialogOutcome?.practices.find(({ id }) => id === selection);
  const returnsToTry = dialogOutcome && (exercisesById.has(dialogOutcome.id) || GROWTH_PRESETS.some(({ id }) => id === dialogOutcome.id));
  const reportError = (error: unknown) => setFeedback({ text: error instanceof Error ? error.message : '操作失败，请重试。', error: true });
  const groupEditor = (trigger: HTMLButtonElement) => {
    setSelection(group?.name ?? '');
    setDialog({ kind: 'group', id: group?.id, trigger });
  };

  return (
    <div className="growth-workspace">
      {exerciseDraft && <section className="module-card growth-editor" aria-label="卡片编辑">
        <GrowthExerciseForm {...exerciseDraft} onCancel={() => {
          setExerciseDraft(undefined);
          window.requestAnimationFrame(() => exerciseTrigger.current?.focus());
        }} onSaved={() => {
          setExerciseDraft(undefined);
          const href = exerciseHref(exerciseDraft.exercise.id, group?.id);
          if (window.location.hash !== href) window.location.assign(href);
          else window.requestAnimationFrame(() => focusedOutcome.current?.focus());
        }} />
      </section>}
      {draft && (
        <section className="module-card growth-editor" aria-label="实践编辑">
          <GrowthPracticeForm draft={draft} onClose={closeEditor} />
        </section>
      )}
      <section className="growth-board" aria-label={group && activeView === 'all' ? group.name : activeView === 'try' ? '待尝试' : '已完成'} hidden={Boolean(draft || exerciseDraft) || activeView === 'topics'}>
        <div className="growth-board-toolbar">
          <nav className="growth-views" aria-label="实践状态">
            {group && <a href={growthBoardHref('all', group.id)} aria-current={activeView === 'all' ? 'page' : undefined}>全部</a>}
            {GROWTH_VIEWS.map((view) => <a key={view.id} href={growthBoardHref(view.id, group?.id)} aria-current={activeView === view.id ? 'page' : undefined}>{view.label}</a>)}
          </nav>
          <label className="growth-filter">卡组
            <select aria-label="卡组" value={group?.id ?? ''} onChange={(event) => {
              const id = event.target.value;
              window.location.hash = growthBoardHref(id ? 'all' : boardView, id);
            }}>
              <option value="">所有卡片</option>
              {groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <button type="button" className="growth-board-group-button" onClick={(event) => groupEditor(event.currentTarget)} disabled={!canOpenForm}>
            {group ? '管理卡组' : '新建卡组'}
          </button>
          <label className="growth-filter">按领域筛选
            <select value={selectedDomain} onChange={(event) => {
              setDomain(event.target.value as GrowthDomain | '');
              if (outcomeId || cardId || exerciseId) window.location.hash = boardHref;
            }}>
              <option value="">全部领域</option>
              {GROWTH_DOMAINS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          {activeView !== 'try' ? (
            <button type="button" className="note-button growth-board-primary" disabled={!canOpenForm} onClick={(event) => begin({
              outcome: { id: generateId(), title: '', domains: selectedDomain ? [selectedDomain] : [] }, preset: false, groupId: group?.id,
            }, event.currentTarget)}>记录自定义成果</button>
          ) : (
            <div className="growth-board-primary">
              <button ref={addTrigger} type="button" className="note-button" popoverTarget="growth-add-exercise" disabled={!canOpenForm}>添加待尝试</button>
              <div ref={addMenu} id="growth-add-exercise" popover="auto" className="workspace-context-menu growth-add-exercise" onToggle={(event) => {
                const menu = event.currentTarget;
                const box = addTrigger.current?.getBoundingClientRect();
                if (!box || !menu.matches(':popover-open')) return;
                menu.style.left = `${Math.max(8, box.right - menu.offsetWidth)}px`;
                menu.style.top = `${Math.min(box.bottom + 6, window.innerHeight - menu.offsetHeight - 8)}px`;
              }}>
                <button type="button" onClick={() => {
                  addMenu.current?.hidePopover();
                  if (addTrigger.current) editExercise(addTrigger.current);
                }}>自己填写</button>
                <button type="button" onClick={() => {
                  addMenu.current?.hidePopover();
                  openGrowthRecommendations(domain || undefined);
                }}>让智能体推荐</button>
              </div>
            </div>
          )}
          {activeView === 'try' && hiddenPresetIds.length > 0 && <button type="button" className="growth-board-group-button" disabled={!canOpenForm}
            onClick={() => { setSelection(hiddenPresetIds[0]); setDialog({ kind: 'restore' }); }}>恢复内置练习</button>}
        </div>
        {error && <p role="alert">{error}</p>}
        {feedback && <p className="growth-muted" role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
        {activeView !== 'try' && (
          <div>
            {activeView === 'all' && completedCards.length > 0 && <h2 className="growth-group-status">已完成</h2>}
            {activeView === 'recent' && isLoaded && !error && completedCards.length === 0 && (
              <p className="growth-muted">{selectedDomain || group ? '当前筛选下没有已完成的卡片。' : '还没有成果记录。可以从「待尝试」选一项练习，或记录自己的成果。'}</p>
            )}
            {activeOutcome ? (
              <article className="growth-card growth-outcome growth-detail" aria-label={activeOutcome.title}>
                <a className="growth-back-link" href={group ? growthBoardHref('all', group.id) : boardHref}>← 返回卡片</a>
                <h2 ref={focusedOutcome} tabIndex={-1}>{activeOutcome.title}</h2>
                <small className="growth-muted">{activeOutcome.practices.length} 次实践</small>
                {activeDescription && <p className="growth-note">{activeDescription}</p>}
                {activeExercise?.done && <p className="growth-note"><strong>完成条件</strong> {activeExercise.done}</p>}
                <ol className="growth-practices">
                  {activeOutcome.practices.map((practice) => {
                    const focused = practiceTarget?.outcomeId === activeOutcome.id && practiceTarget.practiceId === practice.id;
                    return (
                      <li key={practice.id} ref={focused ? focusedPractice : undefined} tabIndex={focused ? -1 : undefined} data-practice-focus={focused || undefined}>
                        <div className="growth-heading">
                          <div>
                            <time dateTime={practice.date}>{practice.date}</time>
                            {notice?.saved?.outcomeId === activeOutcome.id && notice.saved.id === practice.id && (
                              <span className="growth-save-status" role="status">{notice.text}</span>
                            )}
                          </div>
                          <div>
                            <button type="button" className="knowledge-text-button" disabled={!canOpenForm} onClick={(event) => begin({ outcome: activeOutcome, preset: Boolean(activePreset), practice }, event.currentTarget)}>编辑实践</button>
                            <button type="button" className="knowledge-text-button danger" disabled={!canOpenForm}
                              onClick={(event) => choosePractice('delete', activeOutcome, event.currentTarget, practice)}>删除实践</button>
                          </div>
                        </div>
                        {practice.note && <p className="growth-note">{practice.note}</p>}
                        <PracticeSources outcomeId={activeOutcome.id} practice={practice} />
                      </li>
                    );
                  })}
                </ol>
              </article>
            ) : <div className="growth-card-grid">
              {completedCards.map((outcome) => {
                const latest = outcome.practices[0];
                const preset = GROWTH_PRESETS.find((item) => item.id === outcome.id);
                const description = outcome.description ?? exercisesById.get(outcome.id)?.action ?? preset?.cue;
                const note = latest.note.trim();
                const href = `#path/${encodeURIComponent(outcome.id)}` + (group ? '?' + new URLSearchParams({ group: group.id }) : '');
                return <GrowthCard key={outcome.id} id={outcome.id} href={href} highlighted={active && cardId === outcome.id}
                  card={{ title: outcome.title, domains: outcome.domains, description: [description, note].filter(Boolean).join('\n') }}
                  actions={[
                    { label: '编辑实践', run: canOpenForm ? (trigger) => choosePractice('edit', outcome, trigger) : undefined },
                    { label: '删除实践', run: canOpenForm ? (trigger) => choosePractice('delete', outcome, trigger) : undefined },
                    moveAction(outcome.id),
                  ]}
                  recordLabel="追加实践" onRecord={canOpenForm ? (trigger) => begin({ outcome, preset: Boolean(preset) }, trigger) : undefined}>
                  {description && <p className="growth-card-summary">{description}</p>}
                  {note && <p className="growth-card-summary">{note}</p>}
                  <small className="growth-muted">{outcome.practices.length} 次实践 · <time dateTime={latest.date}>{latest.date}</time></small>
                </GrowthCard>;
              })}
            </div>}
          </div>
        )}
        {activeView !== 'recent' && (
          <div>
            {activeView === 'all' && pendingCards.length > 0 && <h2 className="growth-group-status">待尝试</h2>}
            {pendingCards.length === 0 && (activeView === 'try' || completedCards.length === 0) &&
              <p className="growth-muted">{activeView === 'all' ? '当前卡组没有符合筛选条件的卡片。' : '当前筛选下没有待尝试的卡片。'}</p>}
            {activeExerciseDetails ? <article className="growth-card growth-outcome growth-detail" aria-label={activeExerciseDetails.title}>
              <a className="growth-back-link" href={boardHref}>← 返回卡片</a>
              <div className="growth-heading">
                <h2 ref={focusedOutcome} tabIndex={-1}>{activeExerciseDetails.title}</h2>
                <div className="code-actions">
                  <button type="button" className="note-button secondary" disabled={!canOpenForm}
                    onClick={(event) => editExercise(event.currentTarget, activeExerciseDetails)}>编辑卡片</button>
                  <button type="button" className="note-button" disabled={!canOpenForm}
                    onClick={(event) => recordExercise(activeExerciseDetails, event.currentTarget)}>我做到了</button>
                </div>
              </div>
              <div className="growth-card-meta">{activeExerciseDetails.domains.map((tag) => <span key={tag} className="growth-domain" data-domain={tag}>{tag}</span>)}</div>
              {activeExerciseDetails.action && <p className="growth-note">{activeExerciseDetails.action}</p>}
              {activeExerciseDetails.done && <p className="growth-note"><strong>完成条件</strong> {activeExerciseDetails.done}</p>}
              <PracticeSources practice={activeExerciseDetails.sources} />
            </article> : <div className="growth-card-grid growth-pending-grid">
              {pendingCards.map((exercise) => {
                const { id, title, domains, action, done } = exercise;
                return <GrowthCard key={id} id={id} href={exerciseHref(id, group?.id)} highlighted={active && cardId === id}
                  card={{ title, domains, description: done ? `${action}\n完成条件：${done}` : action }} recordLabel="我做到了"
                  actions={[{ label: '编辑卡片', run: canOpenForm ? (trigger) => editExercise(trigger, exercise) : undefined },
                    moveAction(id), { label: '移出待尝试', run: canOpenForm ? () => {
                    if (!window.confirm(`移出「${title}」？`)) return;
                    try { removeExercise(id); setFeedback({ text: '已移出待尝试。' }); } catch (error) { reportError(error); }
                  } : undefined }]}
                  onRecord={canOpenForm ? (trigger) => recordExercise(exercise, trigger) : undefined}>
                  <p className="growth-card-summary">{action || done}</p>
                </GrowthCard>;
              })}
            </div>}
          </div>
        )}
      </section>
      {active && dialog?.kind === 'restore' && <GrowthBoardDialog title="恢复内置练习" action="恢复"
        onClose={() => setDialog(undefined)} onSave={() => {
          restorePreset(selection);
          setFeedback({ text: '已恢复内置练习。' });
        }}>
        <label className="growth-field">内置练习<select value={selection} onChange={(event) => setSelection(event.target.value)}>
          {GROWTH_PRESETS.filter(({ id }) => hiddenPresetIds.includes(id)).map(({ id, title }) =>
            <option key={id} value={id}>{exercisesById.get(id)?.title ?? title}</option>)}
        </select></label>
      </GrowthBoardDialog>}
      {active && dialog?.kind === 'group' && <GrowthBoardDialog title={dialog.id ? '管理卡组' : '新建卡组'} action={dialog.id ? '保存名称' : '创建卡组'}
        valid={Boolean(selection.trim())} onClose={() => setDialog(undefined)} onSave={() => {
          const id = saveGroup(selection, dialog.id);
          window.location.assign(growthBoardHref('all', id));
        }}>
        <label className="growth-field">卡组名称<input autoFocus maxLength={60} value={selection} onChange={(event) => setSelection(event.target.value)} /></label>
        {dialog.id && <button type="button" className="knowledge-text-button danger" onClick={() => {
          if (!dialog.id || !window.confirm('删除这个卡组？其中的卡片会保留在所有卡片里。')) return;
          try {
            removeGroup(dialog.id);
            setDialog(undefined);
            window.location.assign('#path');
          } catch (error) { setDialog(undefined); reportError(error); }
        }}>删除卡组</button>}
      </GrowthBoardDialog>}
      {active && dialog?.kind === 'move' && <GrowthBoardDialog title="移到卡组" action="确认移动" onClose={() => setDialog(undefined)} onSave={() => {
        if (!dialog.id) return;
        moveCard(dialog.id, selection || null);
        setFeedback({ text: selection ? '已移到所选卡组。' : '已移出卡组。' });
      }}>
        <label className="growth-field">目标卡组
          <select autoFocus value={selection} onChange={(event) => setSelection(event.target.value)}>
            <option value="">未分组</option>
            {groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </GrowthBoardDialog>}
      {active && dialog && (dialog.kind === 'edit' || dialog.kind === 'delete') && dialogOutcome &&
        <GrowthBoardDialog title={dialog.kind === 'edit' ? '选择要编辑的实践' : '删除实践'} action={dialog.kind === 'edit' ? '继续编辑' : '确认删除'}
          valid={Boolean(dialogPractice)} onClose={() => setDialog(undefined)} onSave={() => {
            if (!dialogPractice) return;
            if (dialog.kind === 'edit') {
              if (dialog.trigger) begin({ outcome: dialogOutcome,
                preset: GROWTH_PRESETS.some(({ id }) => id === dialogOutcome.id), practice: dialogPractice }, dialog.trigger);
              return;
            }
            removePractice(dialogOutcome.id, dialogPractice.id);
            if (outcomeId === dialogOutcome.id && dialogOutcome.practices.length === 1) window.location.assign(boardHref);
            setNotice(null);
            setFeedback({ text: '已删除实践。' });
          }}>
          {dialog.practiceId || dialogOutcome.practices.length === 1 ? (
            <p>实践记录 · {dialogPractice?.date}{dialogPractice?.note.trim() && ` · ${dialogPractice.note.trim().slice(0, 55)}`}</p>
          ) : <label className="growth-field">实践记录
            <select autoFocus value={selection} onChange={(event) => setSelection(event.target.value)}>
              {dialogOutcome.practices.map((practice, index) => <option value={practice.id} key={practice.id}>
                {practice.date} · {practice.note.trim().slice(0, 55) || `实践 ${dialogOutcome.practices.length - index}`}
              </option>)}
            </select>
          </label>}
          {dialog.kind === 'delete' && dialogOutcome.practices.length === 1 &&
            <p>{returnsToTry ? '这是最后一次实践，删除后卡片将回到「待尝试」。' : '这是最后一次实践，删除后卡片将从成长记录移除。'}</p>}
        </GrowthBoardDialog>}

      <section className="module-card" aria-label="参考路径与任务" hidden={Boolean(draft) || activeView !== 'topics'}>
        <h2>参考路径</h2>
        <SkillTree />
      </section>
    </div>
  );
}
