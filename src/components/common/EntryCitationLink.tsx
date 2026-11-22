import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { workspaceResourceTarget } from '../../store/workspaceStore';
import type { KnowledgeEntry } from '../../types';
import { entryCitationExcerpt } from '../../utils/entryCitation';
import CitationPreviewLink from './CitationPreviewLink';

function EntryCitationPreview({ entry }: { entry: KnowledgeEntry }) {
  const excerpt = entryCitationExcerpt(entry.content);
  return <div className="entry-citation-summary">
    <strong>{entry.title}</strong>
    {entry.category && <div className="citation-preview-meta">{entry.category}</div>}
    <p>{excerpt || '暂无可预览正文。'}</p>
  </div>;
}

export default function EntryCitationLink({ href, id, children }: { href: string; id: string; children: ReactNode }) {
  const entry = useKnowledgeStore((state) => state.entries.find((item) => item.id === id));
  const loaded = useKnowledgeStore((state) => state.isLoaded);
  const load = useKnowledgeStore((state) => state.loadKnowledge);
  useEffect(() => { if (!loaded) load(); }, [loaded, load]);
  if (!entry) return <span title={loaded ? '引用的词条已不可用' : undefined}>{children}</span>;
  return <CitationPreviewLink href={href} className="entry-citation-link" preview={<EntryCitationPreview entry={entry} />}
    {...workspaceResourceTarget(href)} onClick={(event) => {
      const target = workspaceResourceTarget(href);
      event.currentTarget.target = target.target ?? '';
      event.currentTarget.rel = target.rel ?? '';
    }}>{children}</CitationPreviewLink>;
}
