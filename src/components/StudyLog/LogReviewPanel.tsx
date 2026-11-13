import { useContext, useEffect, useRef, useState } from 'react';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { LOG_REVIEW_MAX_TEXT } from '../../types/logReview';
import type { LogReviewSuggestion } from '../../types/logReview';
import { organizeLog } from '../../utils/logReview';
import { AssistantSlots } from '../Assistant/assistantSlots';

interface ReviewRow { suggestion: LogReviewSuggestion; checked: boolean }
type Phase = '读取日志' | '查询资料并生成建议';

export default function LogReviewPanel({ logId, content, onSelection }: {
  logId: string;
  content: string;
  onSelection: (selection: LogReviewSuggestion[], sourceText: string) => void;
}) {
  const entries = useKnowledgeStore((state) => state.entries);
  const { close } = useContext(AssistantSlots);
  const [focus, setFocus] = useState('');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [result, setResult] = useState<{ text: string; summary: string; queries: string[]; matches: number; related: number }>();
  const [phase, setPhase] = useState<Phase>();
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<number | 'search' | null>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const detailsTrigger = useRef<HTMLButtonElement | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (detail !== null) detailHeading.current?.focus(); }, [detail]);

  const generate = async () => {
    if (!content.trim() || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setError('');
    setPhase('读取日志');
    setRows([]);
    setResult(undefined);
    onSelection([], content);
    try {
      const next = await organizeLog(logId, content, focus.trim(), controller.signal, () => setPhase('查询资料并生成建议'));
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
  const change = (index: number, row: ReviewRow) => {
    const next = rows.map((item, position) => position === index ? row : item);
    setRows(next);
    onSelection(next.filter(({ checked }) => checked).map(({ suggestion }) => suggestion), result?.text ?? content);
  };
  const stale = Boolean(result && result.text !== content);
  const count = rows.filter(({ checked }) => checked).length;
  const description = (item: LogReviewSuggestion) => {
    if (item.kind === 'tag') return `添加标签 · ${item.tag}`;
    if (item.kind === 'entry') return `新建词条 · ${item.title}`;
    return `关联词条 · ${entries.find(({ id }) => id === item.entryId)?.title ?? '词条已不存在'}`;
  };
  const showDetail = (next: number | 'search', trigger: HTMLButtonElement) => {
    detailsTrigger.current = trigger;
    setDetail(next);
  };
  const goBack = () => {
    setDetail(null);
    window.requestAnimationFrame(() => detailsTrigger.current?.focus());
  };
  const returnButton = <button type="button" className="knowledge-text-button" onClick={goBack}>← 返回建议</button>;
  const detailRow = typeof detail === 'number' ? rows[detail] : undefined;
  const item = detailRow?.suggestion;
  const entry = item?.kind === 'link' ? entries.find(({ id }) => id === item.entryId) : undefined;
  const edit = (suggestion: LogReviewSuggestion) => {
    if (typeof detail === 'number' && detailRow) change(detail, { ...detailRow, suggestion });
  };

  return <section className="log-review" aria-label="日志整理建议">
    <div hidden={detail !== null}>
    <p className="knowledge-muted">生成时会将当前日志文字和相关资料的名称、分类发送给 DeepSeek。</p>
    <div className="code-form">
      <label>整理范围（可选）
        <input value={focus} maxLength={200} disabled={Boolean(phase)} placeholder="例如只整理 Tilemap 相关内容"
          onChange={(event) => setFocus(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void generate(); }
          }} />
      </label>
      {content.length > LOG_REVIEW_MAX_TEXT && <p className="knowledge-muted">日志较长，本次只分析前 {LOG_REVIEW_MAX_TEXT} 个字符。</p>}
      <div className="code-actions">
        <button type="button" className="note-button secondary" disabled={Boolean(phase) || !content.trim()} onClick={() => void generate()}>
          {phase ? '整理中…' : result || error ? '重新生成建议' : '生成整理建议'}
        </button>
        {phase && <button type="button" className="knowledge-text-button" onClick={cancel}>取消生成</button>}
      </div>
    </div>
    {phase && <p role="status">{phase}…</p>}
    {error && <p role="alert">{error}</p>}
    {result && <div aria-label="日志整理结果">
      {stale && <p role="status">正文已修改。请重新生成建议，或取消勾选后直接保存正文。</p>}
      <p>{result.summary || (rows.length ? '核对依据后选择要采纳的建议。' : '当前资料没有生成可采纳的建议。')}</p>
      <button type="button" className="knowledge-text-button" onClick={(event) => showDetail('search', event.currentTarget)}>查看检索依据</button>
      <ul className="log-review-items">
        {rows.map((row, index) => {
          const item = row.suggestion;
          const missing = item.kind === 'link' && !entries.some(({ id }) => id === item.entryId);
          return <li key={index}>
            <label className="log-review-choice">
              <input type="checkbox" checked={row.checked} disabled={!row.checked && (stale || missing)}
                onChange={(event) => change(index, { ...row, checked: event.target.checked })} />
              <span>{description(item)}</span>
            </label>
            <button type="button" className="knowledge-text-button" aria-label={`详情 · ${description(item)}`}
              onClick={(event) => showDetail(index, event.currentTarget)}>详情</button>
          </li>;
        })}
      </ul>
    </div>}
    </div>
    {detail === 'search' && result && <div className="log-review-detail">
      {returnButton}
      <h3 ref={detailHeading} tabIndex={-1}>检索依据</h3>
      <p className="knowledge-muted">检索词 {result.queries.join('、') || '无'} · 命中 {result.matches} 个词条 · 查到 {result.related} 项已有直接关联</p>
    </div>}
    {item && <div className="log-review-detail">
        {returnButton}
        <h3 ref={detailHeading} tabIndex={-1}>{description(item)}</h3>
        <blockquote>{item.evidence}</blockquote>
        {entry && <a href={`#knowledge/${encodeURIComponent(entry.id)}`} target="_blank" rel="noopener">查看已有词条</a>}
        <div className="code-form">
          {item.kind === 'tag' && <label>标签<input value={item.tag} maxLength={40} disabled={stale} onChange={(event) => edit({ ...item, tag: event.target.value })} /></label>}
          {item.kind === 'link' && <label>关联说明<input value={item.note} maxLength={300} disabled={stale} onChange={(event) => edit({ ...item, note: event.target.value })} /></label>}
          {item.kind === 'entry' && <>
            <label>词条名称<input value={item.title} maxLength={100} disabled={stale} onChange={(event) => edit({ ...item, title: event.target.value })} /></label>
            <label>词条分类<input value={item.category} maxLength={80} disabled={stale} onChange={(event) => edit({ ...item, category: event.target.value })} /></label>
            <label>词条草稿<textarea rows={4} value={item.content} maxLength={1200} disabled={stale} onChange={(event) => edit({ ...item, content: event.target.value })} /></label>
          </>}
        </div>
    </div>}
    {count > 0 && !stale && <footer className="log-review-footer">
      <span className="knowledge-muted">已选 {count} 项，随日志保存</span>
      <button type="button" className="note-button secondary" onClick={close}>返回日志</button>
    </footer>}
  </section>;
}
