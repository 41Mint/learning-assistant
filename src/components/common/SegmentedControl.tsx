import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';

function positionIndicator(marker: HTMLSpanElement) {
  const selected = marker.parentElement?.querySelector<HTMLElement>(':scope > [aria-current="page"], :scope > [aria-pressed="true"]');
  marker.hidden = !selected?.offsetWidth;
  if (marker.hidden || !selected) return;
  marker.style.width = `${selected.offsetWidth}px`;
  marker.style.height = `${selected.offsetHeight}px`;
  marker.style.transform = `translate(${selected.offsetLeft}px, ${selected.offsetTop}px)`;
}

export default function SegmentedControl({ as: Container = 'div', label, className, children }: {
  as?: 'div' | 'nav';
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const indicator = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (indicator.current) positionIndicator(indicator.current);
  });
  useLayoutEffect(() => {
    const marker = indicator.current;
    if (!marker?.parentElement) return;
    const observer = new ResizeObserver(() => positionIndicator(marker));
    observer.observe(marker.parentElement);
    return () => observer.disconnect();
  }, []);

  return <Container className={className ? `workspace-segments ${className}` : 'workspace-segments'}
    role={Container === 'div' ? 'group' : undefined} aria-label={label}>
    <span ref={indicator} className="workspace-segment-indicator" aria-hidden="true" hidden />
    {children}
  </Container>;
}
