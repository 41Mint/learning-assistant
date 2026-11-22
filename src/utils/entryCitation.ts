import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { RootContent } from 'mdast';
import { markdownReferenceLink } from './markdownEditing';

const markdown = unified().use(remarkParse).use(remarkGfm);
const PREVIEW_LENGTH = 180;

export function entryCitationMarkdown(id: string, label: string) {
  return markdownReferenceLink(label, `#knowledge/${encodeURIComponent(id)}?cite=1`);
}

export function readEntryCitation(href: string): string | undefined {
  const match = /^#knowledge\/([^/?#]+)\?cite=1$/.exec(href);
  if (!match) return;
  try { return decodeURIComponent(match[1]); }
  catch { return; }
}

export function entryCitationExcerpt(content: string): string {
  const pending: RootContent[] = markdown.parse(content).children.reverse();
  let text = '';
  while (pending.length && text.length <= PREVIEW_LENGTH * 2) {
    const node = pending.pop()!;
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'tableCell' || node.type === 'code' || node.type === 'break') text += ' ';
    if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'code') {
      text += node.value.replace(/\s+/g, ' ');
    } else if ('children' in node) {
      for (let index = node.children.length - 1; index >= 0; index--) pending.push(node.children[index]);
    }
  }
  const characters = Array.from(text.trim().slice(0, PREVIEW_LENGTH * 2 + 2));
  return characters.length <= PREVIEW_LENGTH ? characters.join('') : characters.slice(0, PREVIEW_LENGTH).join('').trimEnd() + '…';
}
