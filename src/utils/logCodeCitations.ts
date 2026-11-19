import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { RootContent } from 'mdast';
import { readCodeCitation } from './codeCitation';

const markdown = unified().use(remarkParse).use(remarkGfm);

export function logCitesCode(content: string, versionId: string) {
  if (!content.includes('?cite=1')) return false;
  const links = new Map<string, string>();
  const references = new Set<string>();
  const pending: RootContent[] = [...markdown.parse(content).children];
  while (pending.length) {
    const node = pending.pop()!;
    if (node.type === 'link' && readCodeCitation(node.url)?.id === versionId) return true;
    if (node.type === 'definition') links.set(node.identifier, node.url);
    if (node.type === 'linkReference') references.add(node.identifier);
    if ('children' in node) pending.push(...node.children);
  }
  return [...references].some((id) => readCodeCitation(links.get(id) ?? '')?.id === versionId);
}
