import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { ASSISTANT_CHAT_ENDPOINT, ASSISTANT_REQUEST_BYTES, CHAT_ANSWER_LIMIT, CHAT_HISTORY_LIMIT, CHAT_QUESTION_LIMIT, CHAT_TOPIC_TASK_LIMIT, readGrowthGrouping, readTaskSuggestions } from '../../types/assistantChat';
import type { ChatRequest, ChatTaskSuggestion, ChatTopic } from '../../types/assistantChat';
import { LOG_REVIEW_MAX_TEXT, reviewRecord, reviewText } from '../../types/logReview';
import { assistantAction, isAssistantGuideQuestion } from './assistantActions';
import type { AssistantAction } from './assistantActions';
import { isScriptReference } from './assistantSlots';
import type { AssistantCodeExcerpt, AssistantCodeReference, AssistantGrowthReference } from './assistantSlots';
import AssistantGuide from './AssistantGuide';
import type { AssistantStart } from './AssistantGuide';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useSkillTreeStore } from '../../store/skillTreeStore';
import { useTaskStore } from '../../store/taskStore';
import { describeScript, lineLabel, surroundingCode } from '../../utils/assistantCode';
import GrowthGroupingPlan from './GrowthGroupingPlan';
import type { ProposedGrowthGroup } from './GrowthGroupingPlan';
import TopicTaskPlan from './TopicTaskPlan';

export interface AssistantChatSource { id: string; date: string; text: string; draft: boolean }
interface Turn {
  question: string;
  answer: string;
  source?: { id: string; label: string };
  guide?: boolean;
  groups?: ProposedGrowthGroup[];
  taskPlan?: { topicId: string; suggestions: ChatTaskSuggestion[] };
}
const excerptLabel = (excerpt: AssistantCodeExcerpt) => `${excerpt.path} · ${lineLabel(excerpt)}`;

async function askAssistant(input: ChatRequest, signal: AbortSignal) {
  let body = JSON.stringify(input);
  while (new Blob([body]).size > ASSISTANT_REQUEST_BYTES && input.history.length) {
    input.history = input.history.slice(2);
    body = JSON.stringify(input);
  }
  const response = await fetch(ASSISTANT_CHAT_ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal,
  });
  const value: unknown = await response.json().catch(() => null);
  const answer = reviewRecord(value) ? reviewText(value.answer, CHAT_ANSWER_LIMIT) : '';
  if (!response.ok || !answer) {
    throw new Error((reviewRecord(value) && reviewText(value.error, 300)) || '暂时无法获取回复，请重试。');
  }
  const result = reviewRecord(value) ? value : {};
  return { answer, groups: readGrowthGrouping(result.groups, input.growthSelection?.cards.length ?? 0),
    tasks: input.topic ? readTaskSuggestions(result.tasks) : [] };
}

export default function AssistantChat({ source, active, onAction, codeExcerpt, onRemoveCode, onPickCode, growthReference, onRemoveGrowthReference, page, onTool, onStart }: {
  source?: AssistantChatSource;
  active: boolean;
  onAction: (action: AssistantAction) => void;
  codeExcerpt?: AssistantCodeReference;
  onRemoveCode: () => void;
  onPickCode: () => void;
  growthReference?: AssistantGrowthReference;
  onRemoveGrowthReference: () => void;
  page: string;
  onTool: (tool: 'review' | 'search' | 'practice' | 'code') => void;
  onStart: (page: AssistantStart) => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [reference, setReference] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState(codeExcerpt ? undefined : source?.id);
  const [pending, setPending] = useState<Pick<Turn, 'question' | 'source'>>();
  const [error, setError] = useState('');
  const [contextFor, setContextFor] = useState<AssistantCodeExcerpt>();
  const version = useProjectCodeStore((state) => state.data.versions.find((item) => item.id === codeExcerpt?.versionId));
  const project = useProjectCodeStore((state) => state.data.projects.find((item) => item.id === version?.projectId));
  const wholeScript = isScriptReference(codeExcerpt);
  const fragment = wholeScript ? undefined : codeExcerpt;
  const script = useMemo(() => wholeScript && version ? describeScript(version, project) : undefined, [wholeScript, version, project]);
  const context = useMemo(() => version?.content && fragment ? surroundingCode(version.content, fragment) : undefined, [version, fragment]);
  const includedContext = contextFor && contextFor === fragment ? context : undefined;
  const codeLabel = codeExcerpt && (wholeScript ? `${codeExcerpt.path} · 脚本用途` : excerptLabel(codeExcerpt));
  const suggestedQuestion = wholeScript ? '这个脚本在项目中负责什么？' : '这段代码是做什么的？';
  const controller = useRef<AbortController | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const growthCard = growthReference?.kind === 'card' ? growthReference.card : undefined;
  const growthGroup = growthReference?.kind === 'group' ? growthReference.group : undefined;
  const growthSelection = growthReference?.kind === 'selection' ? growthReference.selection : undefined;
  const topicId = growthReference?.kind === 'topic' ? growthReference.id : undefined;
  const topics = useSkillTreeStore((state) => state.topics);
  const completedIds = useSkillTreeStore((state) => state.completedIds);
  const tasks = useTaskStore((state) => state.tasks);
  const topicNode = topicId ? topics.find(({ id }) => id === topicId) : undefined;
  const topicTasks = topicNode ? tasks.filter(({ parentSkillId }) => parentSkillId === topicNode.id) : [];
  const topic: ChatTopic | undefined = topicNode && {
    name: topicNode.name, category: topicNode.category, description: topicNode.description, completed: completedIds.includes(topicNode.id),
    related: topics.filter(({ id }) => topicNode.prerequisites.includes(id)).slice(0, CHAT_TOPIC_TASK_LIMIT).map(({ name }) => name),
    totalTasks: topicTasks.length, tasks: topicTasks.toSorted((a, b) => b.updatedAt - a.updatedAt).slice(0, CHAT_TOPIC_TASK_LIMIT)
      .map(({ title, completed }) => ({ title: title.trim().slice(0, 100), completed })),
  };
  const growthLabel = topicId ? (topic ? `主题「${topic.name}」` : '已删除的主题') : growthGroup ? `卡组「${growthGroup.name}」`
    : growthSelection ? `${growthSelection.totalCards} 张选中的卡片` : growthCard?.title;
  const growthPrompts = topicId ? (topic ? ['这个主题从哪里开始？', '帮我拆成小任务'] : [])
    : growthGroup ? ['这个卡组叫什么更合适？', '组内卡片的分类合适吗？']
    : growthSelection ? ['这些卡片可以怎么分组？']
    : ['这张卡片可以练习哪些内容？', '这个练习可以怎么开始？'];
  const prompts = growthReference ? growthPrompts : codeExcerpt && (!wholeScript || script) ? [suggestedQuestion] : [];
  const availableLogId = codeExcerpt || growthReference ? undefined : source?.id;
  if (sourceId !== availableLogId) {
    setSourceId(availableLogId);
    setReference(null);
  }
  const attached = source && availableLogId === source.id && reference === source.id && source.text.trim() ? source : undefined;

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (active && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [turns, pending, active]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (controller.current || !question.trim()) return;
    const text = question.trim();
    if (isAssistantGuideQuestion(text)) {
      setTurns((previous) => [...previous, { question: text, answer: '', guide: true }]);
      setQuestion('');
      setError('');
      return;
    }
    const action = assistantAction(text);
    if (action && ((!codeExcerpt && !growthReference) || (action.kind === 'recommend' && !topicId))) {
      setError('');
      setQuestion('');
      onAction(action);
      return;
    }
    if (wholeScript && !script) {
      setError('脚本快照已不可用，请重新选择。');
      return;
    }
    if (topicId && !topic) {
      setError('原主题已不可用，请重新选择或移除引用。');
      return;
    }
    const current = new AbortController();
    controller.current = current;
    setError('');
    const sourceInfo = codeExcerpt && codeLabel ? { id: 'code:' + codeExcerpt.id, label: codeLabel }
      : growthReference && growthLabel ? { id: `growth:${growthReference.kind}:${growthReference.id}`, label: growthLabel }
      : attached ? { id: 'log:' + attached.id, label: attached.date + (attached.draft ? ' · 草稿' : '') } : undefined;
    setPending({ question: text, source: sourceInfo });
    const history = turns.filter((turn) => !turn.guide && turn.source?.id === sourceInfo?.id)
      .slice(-(CHAT_HISTORY_LIMIT / 2))
      .flatMap(({ question, answer }) => [
        { role: 'user' as const, content: question },
        { role: 'assistant' as const, content: answer },
      ]);
    const log = attached && { date: attached.date, text: attached.text.slice(0, LOG_REVIEW_MAX_TEXT) };
    const code = fragment && { path: fragment.path, text: fragment.text, startLine: fragment.startLine, endLine: fragment.endLine, context: includedContext };
    try {
      const reply = await askAssistant({ question: text, history, log, code, script, growthCard, growthGroup, growthSelection, topic }, current.signal);
      if (current.signal.aborted) return;
      const groups = growthReference?.kind === 'selection' && growthReference.cardIds.length === growthReference.selection.cards.length
        ? reply.groups.map(({ name, reason, members }) => ({ name, reason, cards: members.map((number) => ({
          id: growthReference.cardIds[number - 1], title: growthReference.selection.cards[number - 1].title,
        })) })) : undefined;
      const taskPlan = growthReference?.kind === 'topic' && reply.tasks.length > 0
        ? { topicId: growthReference.id, suggestions: reply.tasks } : undefined;
      setTurns((previous) => [...previous, { question: text, answer: reply.answer, source: sourceInfo, groups, taskPlan }]);
      setQuestion('');
    } catch (error) {
      if (!current.signal.aborted) setError(error instanceof Error ? error.message : '暂时无法获取回复，请重试。');
    } finally {
      if (controller.current === current) {
        controller.current = null;
        setPending(undefined);
      }
    }
  };
  const cancel = () => {
    controller.current?.abort();
    controller.current = null;
    setPending(undefined);
    composer.current?.focus();
  };
  const renderQuestion = (turn: Pick<Turn, 'question' | 'source'>) => <div className="assistant-chat-question">
    {turn.source && <small>引用 {turn.source.label}</small>}
    <p>{turn.question}</p>
  </div>;
  return <section className="assistant-chat" aria-label="自由问答">
    <div ref={transcript} className="assistant-transcript" role="log" aria-label="问答记录">
      {!turns.length && !pending && !codeExcerpt && !growthReference && <AssistantGuide page={page} onAction={onTool} onStart={onStart} />}
      {turns.map((turn, index) => <div key={index} className="assistant-turn">
        {renderQuestion(turn)}
        {turn.guide ? <AssistantGuide page={page} onAction={onTool} onStart={onStart} /> : <div className="assistant-answer markdown-preview">
          <ReactMarkdown skipHtml disallowedElements={['img', 'a']} unwrapDisallowed>{turn.answer}</ReactMarkdown>
        </div>}
        {turn.groups && turn.groups.length > 0 && <GrowthGroupingPlan suggestions={turn.groups} />}
        {turn.taskPlan && <TopicTaskPlan {...turn.taskPlan} />}
      </div>)}
      {pending && <div className="assistant-turn">{renderQuestion(pending)}<p role="status">正在生成回复…</p></div>}
    </div>
    <form className="assistant-composer" aria-label="发送问题" onSubmit={(event) => void send(event)}>
      {codeExcerpt && <div className="assistant-code-context">
        <p>引用 {codeLabel}</p>
        <button type="button" className="knowledge-text-button" disabled={Boolean(pending)} onClick={onRemoveCode}>{wholeScript ? '移除脚本' : '移除代码片段'}</button>
        {context && <label className="assistant-reference assistant-context-option">
          <input type="checkbox" checked={Boolean(includedContext)} disabled={Boolean(pending)}
            onChange={(event) => setContextFor(event.target.checked ? fragment : undefined)} />
          附带上下文 · {lineLabel(context)}
        </label>}
        <p className="knowledge-muted">{wholeScript ? script
          ? `${script.sampled ? `脚本较长，会发送首尾两段（第 1–${script.parts[0].endLine} 行和第 ${script.parts[1].startLine}–${script.totalLines} 行），边界行可能截断` : `会发送完整脚本（${script.totalLines} 行）`}${script.notes.length ? '及已保存的职责和版本说明' : ''}。`
          : '脚本快照已不可用，请重新选择。'
          : includedContext ? '发送时会附上片段和所示范围的上下文。' : '发送时仅附上选中的代码片段。'}</p>
      </div>}
      {growthReference && <div className="assistant-code-context">
        <p>引用 {growthLabel}</p>
        <button type="button" className="knowledge-text-button" disabled={Boolean(pending)} onClick={onRemoveGrowthReference}>{topicId ? '移除主题' : growthGroup ? '移除卡组' : growthSelection ? '移除所选卡片' : '移除卡片'}</button>
        <p className="knowledge-muted">{topicId
          ? topic
            ? `发送时附上主题说明、相关主题及${topic.totalTasks > topic.tasks.length ? `最近更新的 ${topic.tasks.length} 项任务` : '该主题的任务'}标题与完成状态。`
            : '原主题已不可用。'
          : growthGroup ? growthGroup.totalCards
          ? `发送时附上卡组名称和 ${growthGroup.cards.length === growthGroup.totalCards ? growthGroup.totalCards : `前 ${growthGroup.cards.length} 张（共 ${growthGroup.totalCards} 张）`}卡片的标题、领域、所属看板和说明摘要。`
          : '此卡组暂无卡片，发送时附上卡组名称。' : growthSelection
          ? '发送时附上所选卡片的标题、领域、所属看板和说明摘要。' : '发送时附上卡片标题、领域及当前说明。'}</p>
      </div>}
      {source && !codeExcerpt && !growthReference && <label className="assistant-reference">
        <input type="checkbox" checked={Boolean(attached)} disabled={Boolean(pending) || !source.text.trim()}
          onChange={(event) => setReference(event.target.checked ? source.id : null)} />
        引用当前日志 · {source.date}{source.draft ? '（草稿）' : ''}
      </label>}
      {attached && <p className="knowledge-muted">发送时会将引用的{attached.draft ? '草稿' : '日志'}文字交给 DeepSeek。{attached.text.length > LOG_REVIEW_MAX_TEXT && `只发送前 ${LOG_REVIEW_MAX_TEXT} 个字符。`}</p>}
      {prompts.length > 0 && <div className="assistant-prompts" role="group" aria-label="快捷问题">{prompts.map((prompt) => (
        <button key={prompt} type="button" className="assistant-prompt" disabled={Boolean(pending)} onClick={() => {
          setQuestion(prompt);
          setError('');
          composer.current?.focus();
        }}>{prompt}</button>
      ))}</div>}
      <textarea ref={composer} aria-label="输入问题" rows={3} maxLength={CHAT_QUESTION_LIMIT} placeholder="输入问题…"
        value={question} readOnly={Boolean(pending)} onChange={(event) => { setQuestion(event.target.value); setError(''); }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }} />
      {error && <p role="alert">{error}</p>}
      <div className="assistant-composer-actions">
        <button type="button" className="assistant-code-button" title={codeExcerpt ? '更换代码片段' : '引用代码'}
          aria-label={codeExcerpt ? '更换代码片段' : '引用代码'} disabled={Boolean(pending)} onClick={onPickCode}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 6-6 6 6 6m8-12 6 6-6 6m-2-14-4 16" /></svg>
        </button>
        {turns.length > 0 && <button type="button" className="knowledge-text-button" disabled={Boolean(pending)} onClick={() => {
          setTurns([]);
          setError('');
          composer.current?.focus();
        }}>清空对话</button>}
        {pending
          ? <button key="stop" type="button" className="note-button secondary" onClick={cancel}>停止</button>
          : <button key="send" type="submit" className="note-button" disabled={!question.trim()}>发送</button>}
      </div>
    </form>
  </section>;
}
