import { Fragment } from 'react';
import type { ReactNode } from 'react';
import type { Element, ElementContent, Root as HtmlRoot } from 'hast';
import type { Code, Root, RootContent } from 'mdast';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { codeHighlightOptions } from '../../utils/codeHighlight';

const markdown = unified().use(remarkParse).use(remarkGfm);
const codeHighlight = unified().use(rehypeHighlight, codeHighlightOptions);
const MAX_SOURCE_LENGTH = 100_000;

const tokenClasses: Partial<Record<RootContent['type'], string>> = {
  heading: 'heading',
  strong: 'emphasis',
  emphasis: 'emphasis',
  delete: 'emphasis',
  link: 'link',
  linkReference: 'link',
  image: 'link',
  imageReference: 'link',
  definition: 'link',
  inlineCode: 'code',
  blockquote: 'marker',
  thematicBreak: 'marker',
};

function codeTokens(node: ElementContent, index: number): ReactNode {
  if (node.type === 'text') return node.value;
  if (node.type !== 'element') return null;
  const classes = node.properties.className;
  return <span key={index} className={Array.isArray(classes) ? classes.join(' ') : undefined}>
    {node.children.map(codeTokens)}
  </span>;
}

function highlightFence(original: string, language: Code['lang']): ReactNode {
  const opening = /^(`{3,}|~{3,})[^\n]*\n/.exec(original);
  if (!opening || !language) return <span className="markdown-source-code">{original}</span>;
  const fence = opening[1];
  const lastLineStart = original.lastIndexOf('\n') + 1;
  const closing = /^(?:[ \t]*>[ \t]?)*[ \t]*(`{3,}|~{3,})[ \t]*$/.exec(original.slice(lastLineStart));
  const closed = closing && closing[1].startsWith(fence);
  const bodyEnd = closed ? lastLineStart : original.length;
  const code: Element = {
    type: 'element', tagName: 'code', properties: { className: [`language-${language}`] },
    children: [{ type: 'text', value: original.slice(opening[0].length, bodyEnd) }],
  };
  const tree: HtmlRoot = { type: 'root', children: [{ type: 'element', tagName: 'pre', properties: {}, children: [code] }] };
  codeHighlight.runSync(tree);
  return <>
    <span className="markdown-source-marker">{opening[0]}</span>
    <span className="markdown-source-code">{code.children.map(codeTokens)}</span>
    {closed && <span className="markdown-source-marker">{original.slice(lastLineStart)}</span>}
  </>;
}

function renderRange(node: Root | RootContent, source: string, start: number, end: number): ReactNode {
  if (node.type === 'code') return highlightFence(source.slice(start, end), node.lang);
  if (!('children' in node)) {
    const token = tokenClasses[node.type];
    const text = source.slice(start, end);
    return token ? <span className={`markdown-source-${token}`}>{text}</span> : text;
  }
  const fragments: ReactNode[] = [];
  let offset = start;
  if (node.type === 'listItem') {
    const first = node.children[0]?.position?.start.offset ?? end;
    fragments.push(<span key="marker" className="markdown-source-marker">{source.slice(start, first)}</span>);
    offset = first;
  }
  for (const child of node.children) {
    const first = child.position?.start.offset;
    const last = child.position?.end.offset;
    if (first === undefined || last === undefined || first < offset || last > end) continue;
    fragments.push(source.slice(offset, first));
    fragments.push(<Fragment key={first}>{renderRange(child, source, first, last)}</Fragment>);
    offset = last;
  }
  fragments.push(source.slice(offset, end));
  const token = node.type === 'root' ? undefined : tokenClasses[node.type];
  return token ? <span className={`markdown-source-${token}`}>{fragments}</span> : fragments;
}

export function highlightMarkdownSource(source: string): ReactNode {
  if (!source || source.length > MAX_SOURCE_LENGTH) return null;
  try { return renderRange(markdown.parse(source), source, 0, source.length); }
  catch { return null; }
}
