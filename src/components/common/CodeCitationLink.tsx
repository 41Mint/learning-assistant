import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { lineLabel, scriptLines } from '../../utils/assistantCode';
import { scriptMarkdown } from '../../utils/codeCitation';
import type { CodeLineRange } from '../../utils/codeCitation';
import MarkdownContent from './MarkdownContent';

export default function CodeCitationLink({ href, id, range, children }: { href: string; id: string; range?: CodeLineRange; children: ReactNode }) {
  const load = useProjectCodeStore((state) => state.load);
  const loaded = useProjectCodeStore((state) => state.isLoaded);
  const version = useProjectCodeStore((state) => state.data.versions.find((item) => item.id === id));
  const archived = useProjectCodeStore((state) => state.data.trash.versions.some((item) => item.id === id));
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = !dismissed && (hover || focused);
  const anchor = useRef<HTMLAnchorElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const script = version?.content;
  const lines = useMemo(() => open && script ? scriptLines(script) : [], [open, script]);
  const start = range?.startLine ?? 1;
  const end = Math.min(start + 7, range?.endLine ?? lines.length);
  const excerpt = start <= end && (!range || range.endLine <= lines.length) ? lines.slice(start - 1, end).map((line) => (
    line.length > 320 ? line.slice(0, 320) + '…' : line
  )).join('\n') : null;

  useEffect(() => { if (open && !loaded) void load(); }, [open, loaded, load]);
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const box = anchor.current?.getBoundingClientRect();
      const element = popup.current;
      if (!box || !element) return;
      const { innerWidth, innerHeight } = window;
      element.style.visibility = box.bottom <= 0 || box.top >= innerHeight ? 'hidden' : 'visible';
      element.style.left = Math.max(8, Math.min(box.left, innerWidth - element.offsetWidth - 8)) + 'px';
      const y = box.bottom + element.offsetHeight + 14 <= innerHeight ? box.bottom + 6 : box.top - element.offsetHeight - 6;
      element.style.top = Math.max(8, y) + 'px';
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setDismissed(true); };
    const observer = new ResizeObserver(position);
    if (popup.current) observer.observe(popup.current);
    document.addEventListener('keydown', escape);
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    position();
    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
    };
  }, [open]);
  return <><a ref={anchor} className="code-citation-link" href={href} aria-describedby={open ? tooltipId : undefined}
    onPointerEnter={(event) => { if (event.pointerType === 'mouse') { setHover(true); setDismissed(false); } }}
    onPointerLeave={() => setHover(false)} onFocus={() => { setFocused(true); setDismissed(false); }}
    onBlur={() => setFocused(false)} onClick={() => setDismissed(true)}>{children}<span aria-hidden="true"> ↗</span></a>
    {open && createPortal(<div ref={popup} id={tooltipId} className="code-citation-preview" role="tooltip">
      {!version ? <span>{archived ? '代码版本已移入回收站' : loaded ? '代码版本已不可用' : '正在读取代码版本…'}</span> : <>
        <strong>{version.path}</strong>
        <div>{range ? lineLabel(range) : '完整版本'}{version.note ? ' · ' + version.note : ''}</div>
        {excerpt !== null ? <div className="markdown-preview script-lines"><MarkdownContent content={scriptMarkdown(excerpt)} codeLines firstCodeLine={start} /></div>
          : <div>{version.content === null ? '仅保存了 GitHub 固定链接，打开版本可查看来源。'
            : range ? '所引用的行范围在该快照中不可用。' : '这份脚本为空文件。'}</div>}
        {excerpt !== null && end < (range?.endLine ?? lines.length) && <small>仅预览前 8 行，打开版本查看其余内容</small>}
      </>}
    </div>, document.body)}
  </>;
}
