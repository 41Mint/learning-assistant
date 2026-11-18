import { useContext, useEffect, useId, useRef, useState } from 'react';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { LOG_REVIEW_MAX_TEXT } from '../../types/logReview';
import type { LogReviewSuggestion } from '../../types/logReview';
import { organizeLog } from '../../utils/logReview';
import { AssistantSlots } from '../Assistant/assistantSlots';

interface ReviewRow { suggestion: LogReviewSuggestion; checked: boolean }
type Phase = '读取日志' | '查询资料并生成建议';

export default function LogReviewPanel({ logId, content, formId, onSelection, onApply, onReturn }: {
  logId: string;
  content: string;
  formId: string;
  onSelection?: (selection: LogReviewSuggestion[], sourceText: string) => void;
  onApply?: (selection: LogReviewSuggestion[], sourceText: string) => void;
  onReturn?: () => void;
}) {
  const entries = useKnowledgeStore((state) => state.entries);
  const { reviewFocus } = useContext(AssistantSlots);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [result, setResult] = useState<{ text: string; summary: string; queries: string[]; matches: number; related: number }>();
  const [phase, setPhase] = useState<Phase>();
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const panelId = useId();
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const generate = async () => {
    if (!content.trim() || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setError('');
    setApplied(false);
    setPhase('读取日志');
    setRows([]);
    setExpanded(new Set());
    setResult(undefined);
    onSelection?.([], content);
    try {
      const next = await organizeLog(logId, content, reviewFocus.trim(), controller.signal, () => setPhase('查询资料并生成建议'));
      if (controller.signal.aborted) return;
      setResult({ text: content, summary: next.summary, queries: next.queries, matches: next.context.entries.length, related: next.context.related.length });
      setRows(next.suggestions.map((suggestion) => ({ suggestion, checked: false })));
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : '整理建议生成失败，请重试。');
    } finally {
      if (request.current === controller) {
        request.current = null;
        setPhase(undefined);
      }
    }
  };
  const cancel = () => {
    request.current?.abort();
    request.current = null;
    setPhase(undefined);
  };
  const updateRows = (next: ReviewRow[]) => {
    setRows(next);
    onSelection?.(next.filter(({ checked }) => checked).map(({ suggestion }) => suggestion), result?.text ?? content);
  };
  const change = (index: number, row: ReviewRow) => updateRows(rows.map((item, position) => position === index ? row : item));
  const stale = Boolean(result && result.text !== content);
  const count = rows.filter(({ checked }) => checked).length;
  const categories = [...new Set(entries.map(({ category }) => category).filter(Boolean))];
  const isAvailable = (item: LogReviewSuggestion) => item.kind !== 'link' || entries.some(({ id }) => id === item.entryId);
  const available = rows.filter(({ suggestion }) => isAvailable(suggestion));
  const allSelected = available.length > 0 && available.every(({ checked }) => checked);
  const description = (item: LogReviewSuggestion) => {
    if (item.kind === 'tag') return `添加标签 · ${item.tag}`;
    if (item.kind === 'entry') return `新建词条 · ${item.title}`;
    return `关联词条 · ${entries.find(({ id }) => id === item.entryId)?.title ?? '词条已不存在'}`;
  };
  return <section className="log-review" aria-label="日志整理建议">
    <p className="knowledge-muted">生成时会将当前日志文字和相关资料的名称、分类发送给 DeepSeek。</p>
    <form id={formId} className="code-form" data-preserves-on-navigation onSubmit={(event) => {
      event.preventDefault();
      void generate();
    }}>
      {content.length > LOG_REVIEW_MAX_TEXT && <p className="knowledge-muted">日志较长，本次只分析前 {LOG_REVIEW_MAX_TEXT} 个字符。</p>}
      <div className="code-actions">
        <button type="submit" className="note-button secondary" disabled={Boolean(phase) || !content.trim()}>
          {phase ? '整理中…' : result || error ? '重新生成建议' : '生成整理建议'}
        </button>
        {phase && <button type="button" className="knowledge-text-button" onClick={cancel}>取消生成</button>}
      </div>
    </form>
    {phase && <p role="status">{phase}…</p>}
    {error && <p role="alert">{error}</p>}
    {applied && <p role="status">已保存所选整理建议。</p>}
    {result && <div aria-label="日志整理结果">
      {stale && <p role="status">正文已修改。请重新生成建议，或取消勾选后直接保存正文。</p>}
      <p>{result.summary || (rows.length ? '核对依据后选择要采纳的建议。' : '当前资料没有生成可采纳的建议。')}</p>
      <details className="log-review-search">
        <summary>查看检索依据</summary>
        <p className="knowledge-muted">检索词 {result.queries.join('、') || '无'} · 命中 {result.matches} 个词条 · 查到 {result.related} 项已有直接关联</p>
      </details>
      {!applied && rows.length > 0 && <label className="log-review-choice log-review-select-all">
        <input type="checkbox" checked={!stale && allSelected} disabled={(stale || available.length === 0) && count === 0}
          ref={(input) => { if (input) input.indeterminate = count > 0 && (stale || !allSelected); }}
          onChange={() => updateRows(rows.map((row) => ({ ...row, checked: !stale && !allSelected && isAvailable(row.suggestion) })))} />
        {stale ? '取消全部选择' : '全选建议'}
      </label>}
      <datalist id={`${panelId}-categories`}>{categories.map((category) => <option key={category} value={category} />)}</datalist>
      <ul className="log-review-items">
        {rows.map((row, index) => {
          const item = row.suggestion;
          const open = expanded.has(index);
          const detailId = `${panelId}-detail-${index}`;
          const entry = item.kind === 'link' ? entries.find(({ id }) => id === item.entryId) : undefined;
          const edit = (suggestion: LogReviewSuggestion) => change(index, { ...row, suggestion });
          return <li key={index}>
            <div className="log-review-row">
              <label className="log-review-choice">
                <input type="checkbox" checked={row.checked} disabled={applied || !row.checked && (stale || !isAvailable(item))}
                  aria-label={description(item)} onChange={(event) => change(index, { ...row, checked: event.target.checked })} />
                <span>{description(item)}{item.kind === 'entry' && <small className="knowledge-muted log-review-category">{item.category || '未分类'}</small>}</span>
              </label>
              <button type="button" className="knowledge-text-button" aria-label={`${open ? '收起' : '展开'} · ${description(item)}`}
                aria-expanded={open} aria-controls={detailId} onClick={() => setExpanded((current) => {
                  const next = new Set(current);
                  if (open) next.delete(index);
                  else next.add(index);
                  return next;
                })}>{open ? '收起' : '展开'}</button>
            </div>
            <div id={detailId} className="log-review-reveal" data-open={open || undefined} inert={!open} aria-hidden={!open}>
              <div className="log-review-detail">
                <blockquote>{item.evidence}</blockquote>
                {entry && <a href={`#knowledge/${encodeURIComponent(entry.id)}`} target="_blank" rel="noopener">查看已有词条</a>}
                <div className="code-form">
                  {item.kind === 'tag' && <label>标签<input value={item.tag} maxLength={40} disabled={stale || applied} onChange={(event) => edit({ ...item, tag: event.target.value })} /></label>}
                  {item.kind === 'link' && <label>关联说明<input value={item.note} maxLength={300} disabled={stale || applied} onChange={(event) => edit({ ...item, note: event.target.value })} /></label>}
                  {item.kind === 'entry' && <>
                    <label>词条名称<input value={item.title} maxLength={100} disabled={stale || applied} onChange={(event) => edit({ ...item, title: event.target.value })} /></label>
                    <label>词条分类<input value={item.category} list={`${panelId}-categories`} maxLength={80} disabled={stale || applied} onChange={(event) => edit({ ...item, category: event.target.value })} /></label>
                    <label>词条草稿<textarea rows={4} value={item.content} maxLength={1200} disabled={stale || applied} onChange={(event) => edit({ ...item, content: event.target.value })} /></label>
                  </>}
                </div>
              </div>
            </div>
          </li>;
        })}
      </ul>
    </div>}
    {result && count > 0 && !stale && !applied && <footer className="log-review-footer">
      <span className="knowledge-muted">已选 {count} 项{!onApply && '，随日志保存'}</span>
      {onApply ? <button type="button" className="note-button" onClick={() => {
        try {
          onApply(rows.filter(({ checked }) => checked).map(({ suggestion }) => suggestion), result.text);
          setError('');
          setApplied(true);
        } catch (error) {
          setError(error instanceof Error ? error.message : '保存整理建议失败，请重试。');
        }
      }}>保存所选建议</button> : <button type="button" className="note-button secondary" onClick={onReturn}>返回日志</button>}
    </footer>}
  </section>;
}
