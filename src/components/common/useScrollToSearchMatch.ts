import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { SearchLocation } from '../../store/workspaceStore';

export function useScrollToSearchMatch(container: RefObject<HTMLElement | null>, search: SearchLocation | null, content?: string) {
  useEffect(() => {
    if (!search) return;
    const frame = window.requestAnimationFrame(() => {
      const area = container.current;
      if (!area || area.closest('[hidden]')) return;
      const match = area.querySelector('[data-search-body] .search-match') ?? area.querySelector('.search-match');
      (match ?? area).scrollIntoView({ block: match ? 'center' : 'start', inline: 'nearest', behavior: 'instant' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [container, search, content]);
}
