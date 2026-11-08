import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { SearchLocation } from '../../store/workspaceStore';
import { textMatches } from '../../utils/searchMatches';
import MarkdownContent from './MarkdownContent';

const PREVIEW_HEIGHT = 320;

export default function CollapsibleNote({ content, actions, search }: { content: string; actions?: ReactNode; search?: SearchLocation | null }) {
  const contentId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<{ search: typeof search; expanded: boolean }>();
  const [isLong, setIsLong] = useState(false);
  const expanded = view && view.search === search ? view.expanded : Boolean(search && textMatches(content, search.words, true).length);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    // 图片加载、字体或窗口尺寸变化后重新判断，短笔记不显示多余按钮。
    const observer = new ResizeObserver(() => setIsLong(body.getBoundingClientRect().height > PREVIEW_HEIGHT + 1));
    observer.observe(body);
    return () => observer.disconnect();
  }, []);

  const collapse = () => {
    setView({ search, expanded: false });
    requestAnimationFrame(() => containerRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  };

  return (
    <div className="collapsible-note" ref={containerRef}>
      <div className="history-note-actions">
        {actions}
        {isLong && (
          <button type="button" className="note-button secondary" aria-expanded={expanded} aria-controls={contentId} onClick={() => expanded ? collapse() : setView({ search, expanded: true })}>
            {expanded ? '收起正文' : '展开全文'}
          </button>
        )}
      </div>
      <div id={contentId} className="collapsible-note-window" data-expanded={expanded} style={{ maxHeight: expanded ? undefined : `${PREVIEW_HEIGHT}px` }}>
        <div className="markdown-preview history-content" ref={bodyRef} data-search-body><MarkdownContent content={content} searchWords={search?.words} /></div>
        {isLong && !expanded && <div className="collapsible-note-fade" aria-hidden="true" />}
      </div>
      {isLong && !expanded && <p className="note-preview-hint">当前显示正文预览，展开可查看完整图文。</p>}
      {isLong && expanded && (
        <button type="button" className="note-button secondary" onClick={collapse} aria-controls={contentId} aria-expanded={true}>收起并返回正文开头</button>
      )}
    </div>
  );
}
