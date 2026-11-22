import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { lineLabel, scriptLines } from '../../utils/assistantCode';
import { scriptMarkdown } from '../../utils/codeCitation';
import type { CodeLineRange } from '../../utils/codeCitation';
import CitationPreviewLink from './CitationPreviewLink';
import MarkdownContent from './MarkdownContent';

function CodeCitationPreview({ id, range }: { id: string; range?: CodeLineRange }) {
  const load = useProjectCodeStore((state) => state.load);
  const loaded = useProjectCodeStore((state) => state.isLoaded);
  const version = useProjectCodeStore((state) => state.data.versions.find((item) => item.id === id));
  const archived = useProjectCodeStore((state) => state.data.trash.versions.some((item) => item.id === id));
  const script = version?.content;
  const lines = useMemo(() => script ? scriptLines(script) : [], [script]);
  const start = range?.startLine ?? 1;
  const end = Math.min(start + 7, range?.endLine ?? lines.length);
  const excerpt = start <= end && (!range || range.endLine <= lines.length) ? lines.slice(start - 1, end).map((line) => (
    line.length > 320 ? line.slice(0, 320) + '…' : line
  )).join('\n') : null;

  useEffect(() => { if (!loaded) void load(); }, [loaded, load]);
  if (!version) return <span>{archived ? '代码版本已移入回收站' : loaded ? '代码版本已不可用' : '正在读取代码版本…'}</span>;
  return <>
    <strong>{version.path}</strong>
    <div className="citation-preview-meta">{range ? lineLabel(range) : '完整版本'}{version.note ? ' · ' + version.note : ''}</div>
    {excerpt !== null ? <div className="markdown-preview script-lines"><MarkdownContent content={scriptMarkdown(excerpt)} codeLines firstCodeLine={start} /></div>
      : <div>{version.content === null ? '仅保存了 GitHub 固定链接，打开版本可查看来源。'
        : range ? '所引用的行范围在该快照中不可用。' : '这份脚本为空文件。'}</div>}
    {excerpt !== null && end < (range?.endLine ?? lines.length) && <small>仅预览前 8 行，打开版本查看其余内容</small>}
  </>;
}

export default function CodeCitationLink({ href, id, range, children }: { href: string; id: string; range?: CodeLineRange; children: ReactNode }) {
  return <CitationPreviewLink className="code-citation-link" href={href} preview={<CodeCitationPreview id={id} range={range} />}>
    {children}<span aria-hidden="true"> ↗</span>
  </CitationPreviewLink>;
}
