import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';

type CitationPreviewLinkProps = Pick<ComponentPropsWithoutRef<'a'>, 'href' | 'className' | 'target' | 'rel' | 'onClick' | 'children'>
  & { preview: ReactNode };

export default function CitationPreviewLink({ preview, children, onClick, ...link }: CitationPreviewLinkProps) {
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = !dismissed && (hover || focused);
  const anchor = useRef<HTMLAnchorElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<number>(undefined);
  const tooltipId = useId();

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const box = anchor.current?.getBoundingClientRect();
      const element = popup.current;
      if (!box || !element) return;
      const { innerWidth, innerHeight } = window;
      const below = innerHeight - box.bottom - 14;
      const above = box.top - 14;
      const naturalHeight = element.scrollHeight + element.offsetHeight - element.clientHeight;
      const opensBelow = naturalHeight <= below || below >= above;
      element.style.visibility = box.bottom <= 0 || box.top >= innerHeight ? 'hidden' : 'visible';
      element.style.left = Math.max(8, Math.min(box.left, innerWidth - element.offsetWidth - 8)) + 'px';
      element.style.top = opensBelow ? Math.max(8, box.bottom + 6) + 'px' : 'auto';
      element.style.bottom = opensBelow ? 'auto' : Math.max(8, innerHeight - box.top + 6) + 'px';
      element.style.maxHeight = Math.max(0, opensBelow ? below : above) + 'px';
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setDismissed(true);
      setHover(false);
    };
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

  const beginHover = () => {
    window.clearTimeout(leaveTimer.current);
    setHover(true);
    setDismissed(false);
  };
  const endHover = () => {
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setHover(false), 140);
  };

  return <><a {...link} ref={anchor} aria-describedby={open ? tooltipId : undefined}
    onPointerEnter={(event) => { if (event.pointerType === 'mouse') beginHover(); }}
    onPointerLeave={endHover} onFocus={() => { setFocused(true); setDismissed(false); }}
    onBlur={() => setFocused(false)} onClick={(event) => {
      setDismissed(true);
      setHover(false);
      onClick?.(event);
    }}>{children}</a>
    {open && createPortal(<div ref={popup} id={tooltipId} className="citation-preview" role="tooltip"
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') beginHover(); }} onPointerLeave={endHover}>
      {preview}
    </div>, document.body)}
  </>;
}
