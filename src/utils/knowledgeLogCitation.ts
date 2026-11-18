import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { PhrasingContent } from 'mdast';

const prefix = '#log-ref/';
const markdown = unified().use(remarkParse).use(remarkGfm);

export function knowledgeLogCitation(logId: string): string {
  return `[日志引用](<${prefix}${encodeURIComponent(logId)}>)`;
}

export function citedLogId(href: string): string | undefined {
  if (!href.startsWith(prefix)) return;
  try { return decodeURIComponent(href.slice(prefix.length)); }
  catch { return ''; }
}

function sourceOffset(content: string, phrases: string[]): number | undefined {
  const tree = markdown.parse(content);
  const paragraphs: PhrasingContent[] = [];
  function visit(node: typeof tree | (typeof tree.children)[number] | PhrasingContent) {
    if (node.type === 'paragraph') paragraphs.push(...node.children);
    else if ('children' in node && node.type !== 'link' && node.type !== 'linkReference') {
      for (const child of node.children) visit(child as Parameters<typeof visit>[0]);
    }
  }
  visit(tree);
  for (const phrase of phrases) {
    const first = content.indexOf(phrase);
    if (first < 0 || content.indexOf(phrase, first + phrase.length) >= 0) continue;
    const offset = first + phrase.length;
    if (paragraphs.some((node) => node.type === 'text' && node.position
      && first >= node.position.start.offset! && offset <= node.position.end.offset!)) return offset;
  }
}

const sourcePhrases = (content: string) => [...content.matchAll(/日志示例|日志中|本次日志|原文示例|原文中/gu)].map(([phrase]) => phrase);

export function citeGeneratedEntry(content: string, logId: string, anchor?: string, evidence?: string): string {
  const body = content.trim();
  const offset = sourceOffset(body, [anchor, ...sourcePhrases(body), evidence].filter((phrase): phrase is string => Boolean(phrase)));
  const citation = knowledgeLogCitation(logId);
  return offset === undefined ? body + '\n\n' + citation : body.slice(0, offset) + citation + body.slice(offset);
}

export function alignTrailingLogCitation(content: string): string {
  const trailing = content.match(/\n\n\[日志引用\]\(<#log-ref\/([^<>\s]+)>\)\s*$/u);
  if (!trailing || trailing.index === undefined) return content;
  const body = content.slice(0, trailing.index);
  if (body.includes(prefix)) return content;
  const logId = citedLogId(prefix + trailing[1]);
  const offset = sourceOffset(body, sourcePhrases(body));
  if (!logId || offset === undefined) return content;
  return body.slice(0, offset) + knowledgeLogCitation(logId) + body.slice(offset);
}
