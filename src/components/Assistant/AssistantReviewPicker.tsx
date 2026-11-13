import { useState } from 'react';
import type { StudyLog } from '../../types';
import { useStudyLogStore } from '../../store/studyLogStore';
import { logLabel } from '../../utils/growth';
import { reviewDateFilter } from './assistantActions';

export default function AssistantReviewPicker({ query, onQuery, onSelect }: {
  query: string;
  onQuery: (query: string) => void;
  onSelect: (log: StudyLog) => string | undefined;
}) {
  const logs = useStudyLogStore((state) => state.logs);
  const [error, setError] = useState('');
  const filter = query.trim() ? reviewDateFilter(query) : () => true;
  const matches = filter ? logs.filter((log) => filter(log.date)).sort((a, b) => b.date.localeCompare(a.date)) : [];

  return <section className="assistant-review-picker" aria-label="选择要整理的日志">
    <label htmlFor="assistant-review-date">按日期找日志</label>
    <input id="assistant-review-date" className="search-input" type="search" placeholder="例如 11-5 或 2026-11-05"
      value={query} onChange={(event) => { onQuery(event.target.value); setError(''); }} />
    <p className="knowledge-muted" role="status">{!filter ? '请输入完整日期，或只输入月和日。'
      : !matches.length ? '没有找到这一天的日志。' : query.trim() ? `找到 ${matches.length} 篇日志` : '近期日志'}</p>
    {error && <p role="alert">{error}</p>}
    <ul className="assistant-review-logs">{matches.slice(0, 8).map((log) => <li key={log.id}>
      <button type="button" onClick={() => setError(onSelect(log) ?? '')}>{logLabel(log)}</button>
    </li>)}</ul>
  </section>;
}
