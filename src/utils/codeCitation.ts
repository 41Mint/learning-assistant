import { codeVersionHref } from './projectCode';
import { markdownReferenceLink } from './markdownEditing';

export interface CodeLineRange { startLine: number; endLine: number }

export function parseCodeLines(start: string, end = start): CodeLineRange | undefined {
  if (!/^[1-9]\d*$/.test(start) || !/^[1-9]\d*$/.test(end)) return;
  const startLine = Number(start), endLine = Number(end);
  if (Number.isSafeInteger(startLine) && Number.isSafeInteger(endLine) && startLine <= endLine) return { startLine, endLine };
}

export function readCodeCitation(href: string) {
  const match = /^#code\/([^/?]+)\?cite=1(?:&lines=(\d+)(?:-(\d+))?)?$/.exec(href);
  if (!match) return;
  try {
    const range = match[2] ? parseCodeLines(match[2], match[3]) : undefined;
    if (match[2] && !range) return;
    return { id: decodeURIComponent(match[1]), range };
  } catch { return; }
}

export function codeCitationHref(id: string, range?: CodeLineRange) {
  return `${codeVersionHref(id)}?cite=1${range ? `&lines=${range.startLine}-${range.endLine}` : ''}`;
}

export function codeCitationMarkdown(id: string, label: string, range?: CodeLineRange) {
  return markdownReferenceLink(label, codeCitationHref(id, range));
}

export function scriptMarkdown(text: string) {
  let length = 3;
  for (const match of text.matchAll(/^ {0,3}(~{3,})/gm)) length = Math.max(length, match[1].length + 1);
  const fence = '~'.repeat(length);
  return fence + 'csharp\n' + text + '\n' + fence;
}
