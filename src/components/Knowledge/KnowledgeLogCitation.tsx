import { useId, useRef } from 'react';
import type { StudyLog } from '../../types';
import { logLabel } from '../../utils/growth';

export default function KnowledgeLogCitation({ id, logIds, logs }: { id: string; logIds: readonly string[]; logs: readonly StudyLog[] }) {
  const description = useId();
  const tooltip = useRef<HTMLSpanElement>(null);
  const index = logIds.indexOf(id);
  const log = index >= 0 ? logs.find((item) => item.id === id) : undefined;
  if (!log) return <sup className="knowledge-muted" title="引用日志暂不可用" aria-label="引用日志暂不可用">[?]</sup>;
  const number = index + 1;
  const position = (anchor: HTMLSpanElement) => {
    const left = anchor.getBoundingClientRect().left;
    const width = tooltip.current?.offsetWidth ?? 0;
    const viewport = document.documentElement.clientWidth;
    anchor.style.setProperty('--citation-shift', `${Math.max(8, Math.min(left, viewport - width - 8)) - left}px`);
  };
  return <span className="knowledge-log-citation" onMouseEnter={(event) => position(event.currentTarget)}
    onFocus={(event) => position(event.currentTarget)}>
    <sup><a href={`#history/${log.date}`} aria-label={`日志引用 ${number}`} aria-describedby={description}>[{number}]</a></sup>
    <span ref={tooltip} id={description} className="knowledge-citation-tooltip" role="tooltip">{logLabel(log)}</span>
  </span>;
}
