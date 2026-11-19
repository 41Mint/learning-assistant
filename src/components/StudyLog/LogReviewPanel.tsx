import { useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { LOG_REVIEW_MAX_TEXT, conciseLimit, draftLength, wantsConciseDrafts } from '../../types/logReview';
import type { LogReviewSuggestion } from '../../types/logReview';
import type { ReviewEdit, ReviewField, ReviewItem } from '../../types/reviewConversation';
import { converseAboutLog, organizeLog } from '../../utils/logReview';
import { AssistantSlots } from '../Assistant/assistantSlots';
import type { ReviewConversation, ReviewReply } from '../Assistant/assistantSlots';
import ReviewSuggestionMenu from './ReviewSuggestionMenu';
import type { ReviewMenuAnchor } from './ReviewSuggestionMenu';

interface ReviewRow { suggestion: LogReviewSuggestion; checked: boolean; saved?: boolean }
type Change = { id: number; before: LogReviewSuggestion; after: LogReviewSuggestion };
const labels: Record<ReviewField, string> = { title: '名称', content: '正文', category: '分类', tag: '标签', note: '关联说明' };
const explainOnly = (text: string) => /(?:为什么|为何|什么原因|怎么来的|是什么意思)/u.test(text)
  && !/[，。；;]\s*(?:请|帮我|把|顺便|然后|也|另外)/u.test(text);
const explicitSave = (text: string) => /保存|采纳|写入|入库|收录|记进|记到|加进/u.test(text)
  && !/(?:别|不要|不用|先不|不想|没)(?:.{0,5})(?:保存|采纳|写入|入库|收录|记进|记到|加进)|取消保存|是否|会不会|怎么保存|(?:可以|能)保存.{0,12}吗/u.test(text);
const affirmative = (text: string) => /^(?:好的?|可以|确认|没问题|同意|就这(?:条|几条|些)|对|行)[。！!\s]*$/u.test(text);
const explicitLogSave = (text: string) => /(?:正文|日志|笔记).{0,12}(?:一起|一并|也|都).{0,5}保存|(?:一起|一并)保存.{0,12}(?:正文|日志|笔记)/u.test(text);

function editSuggestion(suggestion: LogReviewSuggestion, fields: ReviewEdit['fields']): LogReviewSuggestion {
  if (suggestion.kind === 'entry') {
    const content = fields.content ?? suggestion.content;
    return { ...suggestion, title: fields.title ?? suggestion.title, category: fields.category ?? suggestion.category,
      content, citationAnchor: fields.content === undefined || (suggestion.citationAnchor && content.includes(suggestion.citationAnchor))
        ? suggestion.citationAnchor : undefined };
  }
  if (suggestion.kind === 'tag') return { ...suggestion, tag: fields.tag ?? suggestion.tag };
  return { ...suggestion, note: fields.note ?? suggestion.note };
}

// This protects explicitly excluded fields; interpretation and target selection happen in the conversation.
function checkEdit(question: string, edit: ReviewEdit, original: LogReviewSuggestion) {
  const titleOnly = /只(?:需要|用)?(?:修改?|调整|换|缩短|精简).{0,9}(?:名称|标题|名字)/u.test(question)
    || /名称|标题|名字/u.test(question) && !/正文|描述|定义|内容/u.test(question) && wantsConciseDrafts(question);
  for (const [field, text] of Object.entries(edit.fields) as [ReviewField, string][]) {
    const names = field === 'title' ? '名称|标题|名字' : field === 'content' ? '正文|描述|定义|内容' : labels[field];
    if (new RegExp(`(?:${names})(?:保持|保留)?(?:不变|别动|不用改|不要改|别改)|(?:别动|不要改|不改|保留)(?:词条)?(?:${names})`, 'u').test(question)) {
      throw new Error(`这次回复试图改动你要求保留的${labels[field]}，草稿没有改变。`);
    }
    if (titleOnly && field !== 'title') throw new Error('这次只要求改名称，草稿的其他字段没有改变。');
    const old = field in original ? (original as unknown as Record<string, string>)[field] : '';
    if (wantsConciseDrafts(question) && text !== old && (field === 'title' || field === 'content') && draftLength(old) >= 5) {
      const limit = field === 'content' ? conciseLimit(question, old) ?? draftLength(old) : draftLength(old) - 1;
      if (draftLength(text) > limit) throw new Error(`这次返回的${labels[field]}没有达到缩短要求，原草稿已保留。`);
    }
  }
}

export default function LogReviewPanel({ logId, date, content, formId, onSelection, onApply, onReturn }: {
  logId: string;
  date: string;
  content: string;
  formId: string;
  onSelection?: (selection: LogReviewSuggestion[], sourceText: string) => void;
  onApply: (selection: LogReviewSuggestion[], sourceText: string, includeLog: boolean) => void | Promise<void>;
  onReturn?: () => void;
}) {
  const entries = useKnowledgeStore((state) => state.entries);
  const { registerReview, reviewReference, setReviewReference, focusAssistantInput } = useContext(AssistantSlots);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [result, setResult] = useState<{ text: string; summary: string; queries: string[]; matches: number }>();
  const [phase, setPhase] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [undo, setUndo] = useState<Change[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [manual, setManual] = useState(false);
  const [menu, setMenu] = useState<ReviewMenuAnchor>();
  const pendingSave = useRef<{ rows: ReviewRow[]; ids: number[] } | undefined>(undefined);
  const panelId = useId();
  const request = useRef<AbortController | null>(null);
  const latestContent = useRef(content);
  useLayoutEffect(() => { latestContent.current = content; }, [content]);
  useEffect(() => () => {
    setReviewReference((current) => current?.formId === formId && current.logId === logId ? undefined : current);
  }, [formId, logId, setReviewReference]);
  useEffect(() => () => request.current?.abort(), []);
  const stale = Boolean(result && result.text !== content);
  const referenceId = reviewReference?.formId === formId && reviewReference.logId === logId ? reviewReference.id : undefined;
  const label = (item: LogReviewSuggestion) => item.kind === 'tag' ? item.tag
    : item.kind === 'entry' ? item.title : entries.find(({ id }) => id === item.entryId)?.title ?? '词条已不存在';
  const description = (item: LogReviewSuggestion) => `${item.kind === 'tag' ? '添加标签' : item.kind === 'entry' ? '新建词条' : '关联词条'} · ${label(item)}`;

  const run = async <T,>(label: string, work: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal) => {
    if (request.current) throw new Error('这一轮还在处理中。');
    const controller = new AbortController();
    request.current = controller;
    const active = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    setError('');
    setStatus('');
    setPhase(label);
    try { active.throwIfAborted(); return await work(active); }
    finally { if (request.current === controller) { request.current = null; setPhase(''); } }
  };
  const updateRows = (next: ReviewRow[]) => {
    pendingSave.current = undefined;
    setRows(next);
    const referenced = referenceId && next[referenceId - 1];
    if (referenced && label(referenced.suggestion) !== reviewReference?.label) {
      setReviewReference((current) => current === reviewReference && current
        ? { ...current, label: label(referenced.suggestion) } : current);
    }
    onSelection?.(next.filter(({ checked, saved }) => checked && !saved).map(({ suggestion }) => suggestion), result?.text ?? content);
  };
  const generate = async (focus: string, signal: AbortSignal) => {
    if (!content.trim()) throw new Error('这篇日志还没有内容可整理。');
    setPhase('读取日志');
    const next = await organizeLog(logId, content, focus, signal, () => setPhase('查询资料并生成草稿'));
    signal.throwIfAborted();
    if (latestContent.current !== content) throw new Error('日志正文在整理时已修改，原草稿已保留。');
    setUndo([]);
    setExpanded(new Set());
    setMenu(undefined);
    setReviewReference((current) => current?.formId === formId && current.logId === logId ? undefined : current);
    onSelection?.([], content);
    pendingSave.current = undefined;
    setResult({ text: content, summary: next.summary, queries: next.queries, matches: next.context.entries.length });
    setRows(next.suggestions.map((suggestion) => ({ suggestion, checked: false })));
    return next.suggestions.length
      ? `已根据 ${date} 的日志整理出 ${next.suggestions.length} 项草稿，尚未保存。可以继续说想改哪一项，或保存哪几项。`
      : next.summary || '这篇日志暂时没有可新增的词条、标签或关联。';
  };
  const commit = async (ids: number[], includeLog: boolean, signal: AbortSignal) => {
    signal.throwIfAborted();
    if (!result || result.text !== latestContent.current || !ids.length) throw new Error('草稿或日志已变化，请先核对。');
    const targets = rows.filter((row, index) => ids.includes(index + 1) && !row.saved);
    if (targets.length !== ids.length) throw new Error('所选草稿已变化，未写入资料。');
    await onApply(targets.map(({ suggestion }) => suggestion), result.text, includeLog);
    updateRows(rows.map((row, index) => ids.includes(index + 1) ? { ...row, saved: true, checked: false } : row));
    return '已保存：' + targets.map(({ suggestion }) => '「' + label(suggestion) + '」').join('、') + '。';
  };
  const saveDrafts = (ids: number[]) => void run('正在保存', (signal) => commit(ids, false, signal))
    .then(setStatus).catch((problem: unknown) => setError(problem instanceof Error ? problem.message : '保存失败。'));
  const undoLast = () => {
    const available = undo.filter(({ id, after }) => !rows[id - 1]?.saved && rows[id - 1]?.suggestion === after);
    if (!available.length) return '没有可撤销的未保存修订。';
    updateRows(rows.map((row, index) => {
      const entry = available.find(({ id }) => id === index + 1);
      return entry ? { ...row, suggestion: entry.before } : row;
    }));
    setUndo([]);
    return `已撤销 ${available.length} 项草稿的上次修订，没有改动已保存的资料。`;
  };
  const respond: ReviewConversation['respond'] = (question, history, signal) => run('正在理解这条消息', async (active): Promise<ReviewReply> => {
    const confirmation = pendingSave.current;
    pendingSave.current = undefined;
    if (confirmation?.rows === rows && affirmative(question)) return { answer: await commit(confirmation.ids, false, active) };

    const items = rows.map(({ suggestion, checked, saved }, index): ReviewItem => ({
      id: index + 1, label: label(suggestion), suggestion, selected: checked, saved: Boolean(saved),
    }));
    const response = await converseAboutLog({ stage: 'conversation', question, history, date, items,
      lastEdited: undo.map(({ id }) => id), referenceId, stale }, active);
    active.throwIfAborted();
    const { operation, answer } = response;
    if (!operation) return { answer };
    if (explainOnly(question)) return { answer: '这是在问原因，我没有修改草稿。' };
    if (operation.kind === 'navigate') return { answer, action: operation.action };
    if (operation.kind === 'generate') return { answer: await generate(operation.focus, active) };
    if (!result || result.text !== latestContent.current) return { answer: '日志正文已变化，草稿没有改变。可以说「重新整理这篇日志」。' };
    if (operation.kind === 'undo') return { answer: undoLast() };
    if (operation.kind === 'save') {
      if (!explicitSave(question)) {
        pendingSave.current = { rows, ids: operation.ids };
        return { answer: `要保存${operation.ids.map((id) => `第 ${id} 项「${label(rows[id - 1].suggestion)}」`).join('、')}吗？还没有写入。可以回复「确认」，也可以重新指定要保存的项。` };
      }
      return { answer: await commit(operation.ids, explicitLogSave(question), active) };
    }
    const changes: Change[] = [];
    const descriptions: string[] = [];
    const edits = new Map(operation.edits.map((edit) => [edit.id, edit]));
    const next = rows.map((row, index) => {
      const edit = edits.get(index + 1);
      if (!edit) return row;
      checkEdit(question, edit, row.suggestion);
      const after = editSuggestion(row.suggestion, edit.fields);
      if (JSON.stringify(after) === JSON.stringify(row.suggestion)) return row;
      changes.push({ id: edit.id, before: row.suggestion, after });
      const title = edit.fields.title && edit.fields.title !== label(row.suggestion)
        ? `名称「${label(row.suggestion)}」→「${edit.fields.title}」` : '';
      const fields = Object.entries(edit.fields).filter(([key, value]) => key !== 'title'
        && (row.suggestion as unknown as Record<string, string>)[key] !== value).map(([key]) => labels[key as ReviewField]);
      descriptions.push(`第 ${edit.id} 项：${[title, ...fields.map((field) => '已修改' + field)].filter(Boolean).join('；')}`);
      return { ...row, suggestion: after };
    });
    if (!changes.length) return { answer: '草稿没有变化。' };
    updateRows(next);
    setUndo(changes);
    return { answer: descriptions.join('\n\n') + '\n\n改动只在草稿里，尚未保存。' };
  }, signal);

  const startGeneration = (focus = '') => {
    void run('读取日志', (signal) => generate(focus, signal)).then(setStatus).catch((problem: unknown) => {
      if (!(problem instanceof DOMException && problem.name === 'AbortError')) setError(problem instanceof Error ? problem.message : '无法整理日志。');
    });
  };
  useLayoutEffect(() => registerReview(formId, { respond, generate: startGeneration }));

  const drafts = rows.filter(({ checked, saved }) => checked && !saved);
  const available = rows.filter(({ suggestion, saved }) => !saved && (suggestion.kind !== 'link' || entries.some(({ id }) => id === suggestion.entryId)));
  const change = (index: number, suggestion: LogReviewSuggestion) =>
    updateRows(rows.map((row, position) => position === index ? { ...row, suggestion } : row));
  const categories = [...new Set(entries.map(({ category }) => category).filter(Boolean))];
  const menuRow = menu && rows[menu.id - 1];
  return <section className="log-review" aria-label="日志整理建议" id={formId} data-preserves-on-navigation>
    <p className="knowledge-muted">{result ? '可按编号或名称直接修改、保存，也可点卡片查看详情。继续对话时，这批草稿会发给 DeepSeek 作为上下文。'
      : '可以直接说「从这篇日志提炼词条」。整理时会将日志文字和相关资料名称发给 DeepSeek。'}</p>
    {content.length > LOG_REVIEW_MAX_TEXT && <p className="knowledge-muted">整理时最多读取前 {LOG_REVIEW_MAX_TEXT} 个字符。</p>}
    {phase && <p role="status">{phase}… <button type="button" className="knowledge-text-button" onClick={() => request.current?.abort()}>停止</button></p>}
    {error && <p role="alert">{error}</p>}
    {status && <p role="status">{status}</p>}
    {result && <div aria-label="日志整理结果">
      {stale && <p role="status">正文已变化，可在对话中要求重新整理。</p>}
      <p>{result.summary}</p>
      <datalist id={panelId + '-categories'}>{categories.map((category) => <option key={category} value={category} />)}</datalist>
      <ul className="log-review-items">
        {rows.map((row, index) => {
          const item = row.suggestion;
          const open = expanded.has(index);
          const detailId = panelId + '-detail-' + index;
          const entry = item.kind === 'link' ? entries.find(({ id }) => id === item.entryId) : undefined;
          const editable = manual && !stale && !row.saved;
          return <li key={index}>
            <div className="log-review-row">
              {manual && <input type="checkbox" checked={row.checked} disabled={Boolean(phase) || row.saved || (!row.checked && (stale || (item.kind === 'link' && !entry)))}
                aria-label={description(item)} onChange={(event) => updateRows(rows.map((other, i) => i === index ? { ...other, checked: event.target.checked } : other))} />}
              <button type="button" className="log-review-card-title" aria-label={`${open ? '收起' : '展开'} · ${description(item)}`}
                aria-expanded={open} aria-controls={detailId} aria-keyshortcuts="Shift+F10"
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenu({ id: index + 1, x: event.clientX, y: event.clientY, trigger: event.currentTarget });
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'ContextMenu' && (event.key !== 'F10' || !event.shiftKey)) return;
                  event.preventDefault();
                  const { left, bottom } = event.currentTarget.getBoundingClientRect();
                  setMenu({ id: index + 1, x: left, y: bottom, trigger: event.currentTarget });
                }}
                onClick={() => setExpanded((current) => {
                  const next = new Set(current);
                  if (open) next.delete(index); else next.add(index);
                  return next;
                })}>
                <span className="log-review-card-index">{index + 1}</span>
                <span>{label(item)}<small className="knowledge-muted log-review-category">{item.kind === 'entry' ? item.category || '新词条' : item.kind === 'tag' ? '标签' : '关联词条'}</small></span>
                <small className="knowledge-muted">{row.saved ? '已保存' : open ? '▾' : '▸'}</small>
              </button>
            </div>
            <div id={detailId} className="log-review-reveal" data-open={open || undefined} inert={!open} aria-hidden={!open}>
              <div className="log-review-detail">
                {!editable && item.kind === 'entry' && <p className="log-review-body">{item.content}</p>}
                {!editable && item.kind === 'link' && item.note && <p>{item.note}</p>}
                <blockquote>{item.evidence}</blockquote>
                {entry && <a href={`#knowledge/${encodeURIComponent(entry.id)}`} target="_blank" rel="noopener">查看已有词条</a>}
                {editable && <fieldset className="code-form log-review-edit-fields" disabled={Boolean(phase)}>
                  {item.kind === 'tag' && <label>标签<input value={item.tag} maxLength={40} onChange={(event) => change(index, { ...item, tag: event.target.value })} /></label>}
                  {item.kind === 'link' && <label>关联说明<input value={item.note} maxLength={300} onChange={(event) => change(index, { ...item, note: event.target.value })} /></label>}
                  {item.kind === 'entry' && <>
                    <label>词条名称<input value={item.title} maxLength={100} onChange={(event) => change(index, { ...item, title: event.target.value })} /></label>
                    <label>词条分类<input value={item.category} list={panelId + '-categories'} maxLength={80} onChange={(event) => change(index, { ...item, category: event.target.value })} /></label>
                    <label>词条草稿<textarea rows={4} value={item.content} maxLength={1200} onChange={(event) => change(index, { ...item, content: event.target.value })} /></label>
                  </>}
                </fieldset>}
              </div>
            </div>
          </li>;
        })}
      </ul>
      {menu && menuRow && <ReviewSuggestionMenu key={menu.id} anchor={menu} title={label(menuRow.suggestion)}
        canSave={!phase && !stale && available.includes(menuRow)} onClose={() => setMenu((current) => current === menu ? undefined : current)}
        onSave={() => saveDrafts([menu.id])}
        onQuote={() => {
          setReviewReference(() => ({ formId, logId, id: menu.id, label: label(menuRow.suggestion) }));
          focusAssistantInput();
        }} />}
    </div>}
    <details className="log-review-search" onToggle={(event) => setManual(event.currentTarget.open)}>
      <summary>手动操作</summary>
      <div className="code-actions">
        <button type="button" className="note-button secondary" disabled={Boolean(phase)} onClick={() => startGeneration()}>
          {result ? '重新生成建议' : '生成整理建议'}
        </button>
        {undo.length > 0 && <button type="button" className="knowledge-text-button" disabled={Boolean(phase) || stale}
          onClick={() => setStatus(undoLast())}>撤销上次修订</button>}
        {drafts.length > 0 && <button type="button" className="note-button" disabled={Boolean(phase) || stale}
          onClick={() => saveDrafts(rows.flatMap((row, index) => row.checked && !row.saved ? [index + 1] : []))}>保存所选建议</button>}
        {onReturn && <button type="button" className="knowledge-text-button" onClick={onReturn}>返回日志</button>}
      </div>
      {available.length > 0 && <label className="log-review-choice log-review-select-all">
        <input type="checkbox" checked={!stale && available.every(({ checked }) => checked)} disabled={Boolean(phase) || stale && !drafts.length}
          ref={(input) => { if (input) input.indeterminate = drafts.length > 0 && (stale || drafts.length !== available.length); }}
          onChange={() => updateRows(rows.map((row) => available.includes(row) || stale ? { ...row, checked: !stale && !available.every(({ checked }) => checked) } : row))} />
        {stale ? '取消全部选择' : '全选建议'}
      </label>}
      {onSelection && drafts.length > 0 && <p className="knowledge-muted">已选 {drafts.length} 项，随日志保存</p>}
      {result && <p className="knowledge-muted">检索词 {result.queries.join('、') || '无'} · 命中 {result.matches} 个词条</p>}
    </details>
  </section>;
}
