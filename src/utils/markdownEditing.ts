export interface MarkdownEdit {
  start: number;
  end: number;
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

const lineFormats = {
  heading: { marker: /^#{1,6}(?:[ \t]+|$)/, prefix: (_number: number, level: HeadingLevel) => '#'.repeat(level) + ' ', placeholder: '标题' },
  quote: { marker: /^>[ \t]?/, prefix: () => '> ', placeholder: '引用内容' },
  bullet: { marker: /^[-+*][ \t]+(?!\[[ xX]\][ \t])/, prefix: () => '- ', placeholder: '列表项' },
  numbered: { marker: /^\d+[.)][ \t]+/, prefix: (number: number) => `${number}. `, placeholder: '列表项' },
  task: { marker: /^[-+*][ \t]+\[[ xX]\][ \t]+/, prefix: () => '- [ ] ', placeholder: '任务内容' },
};

type LineFormat = keyof typeof lineFormats;
export type MarkdownFormat = LineFormat | 'bold' | 'italic' | 'code' | 'link' | 'codeBlock';

function replace(start: number, end: number, text: string, selectFrom = text.length, selectTo = selectFrom): MarkdownEdit {
  return { start, end, text, selectionStart: start + selectFrom, selectionEnd: start + selectTo };
}

function wrap(start: number, end: number, text: string, prefix: string, suffix: string) {
  return replace(start, end, prefix + text + suffix, prefix.length, prefix.length + text.length);
}

export function insertMarkdownBlock(source: string, start: number, end: number, block: string, selection?: [number, number]): MarkdownEdit {
  const before = source.slice(0, start);
  const after = source.slice(end);
  const leadingBreaks = before.match(/\n{0,2}$/)?.[0].length ?? 0;
  const trailingBreaks = after.match(/^\n{0,2}/)?.[0].length ?? 0;
  const prefix = before ? '\n'.repeat(2 - leadingBreaks) : '';
  const suffix = '\n'.repeat(2 - trailingBreaks);
  const [from, to] = selection ?? [block.length + 2, block.length + 2];
  return replace(start, end, prefix + block + suffix, prefix.length + from, prefix.length + to);
}

function formatLines(source: string, start: number, end: number, format: LineFormat, headingLevel: HeadingLevel): MarkdownEdit {
  const first = source.lastIndexOf('\n', start - 1) + 1;
  const from = start === 0 ? 0 : first;
  const after = source.indexOf('\n', Math.max(start, end - 1));
  const to = after < 0 ? source.length : after;
  const lines = source.slice(from, to).split('\n');
  const { marker, prefix, placeholder } = lineFormats[format];
  const list = format === 'bullet' || format === 'numbered' || format === 'task';
  const oldListMarker = /^(?:[-+*]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/;
  if (lines.length === 1 && !lines[0].trim()) {
    const indent = lines[0];
    return wrap(from, to, placeholder, indent + prefix(1, headingLevel), '');
  }

  const unmark = lines.filter((line) => line.trim()).every((line) => {
    const previous = line.trimStart().match(marker)?.[0];
    return previous !== undefined && (format !== 'heading' || previous.trimEnd().length === headingLevel);
  });
  let number = 0;
  const text = lines.map((line) => {
    if (!line.trim()) return line;
    const indent = line.match(/^[ \t]*/)?.[0] ?? '';
    const body = line.slice(indent.length);
    if (unmark) return indent + body.replace(marker, '');
    return indent + prefix(++number, headingLevel) + body.replace(list ? oldListMarker : marker, '');
  }).join('\n');
  if (start === end) {
    const caret = Math.max(0, start - from + text.length - lines[0].length);
    return replace(from, to, text, caret);
  }
  return replace(from, to, text, 0, text.length);
}

function longestBackticks(text: string) {
  return (text.match(/`+/g) ?? []).reduce((longest, item) => Math.max(longest, item.length), 0);
}

export function formatMarkdown(source: string, start: number, end: number, format: MarkdownFormat, headingLevel: HeadingLevel = 2): MarkdownEdit {
  const selected = source.slice(start, end);
  switch (format) {
    case 'bold':
    case 'italic': {
      const bold = format === 'bold';
      const marker = bold ? '**' : '*';
      const before = source.slice(0, start).match(/(?<!\*)\*+$/)?.[0].length ?? 0;
      const after = source.slice(end).match(/^\*+/)?.[0].length ?? 0;
      if (selected && before === after && (bold ? before >= 2 : before % 2 === 1)) {
        return replace(start - marker.length, end + marker.length, selected, 0, selected.length);
      }
      const paragraphs = selected.split(/(\n(?:[ \t]*\n)+)/);
      if (paragraphs.length > 1) {
        const text = paragraphs.map((part) => part.replace(/\S(?:[\s\S]*\S)?/, (body) => marker + body + marker)).join('');
        return replace(start, end, text, 0, text.length);
      }
      const text = selected || '文字';
      const leading = text.match(/^\s*/)?.[0] ?? '';
      const trailing = text.trim() ? text.match(/\s*$/)?.[0] ?? '' : '';
      return wrap(start, end, text.trim() || '文字', leading + marker, marker + trailing);
    }
    case 'code': {
      const code = selected || '代码';
      const fence = '`'.repeat(longestBackticks(code) + 1);
      const space = /^[` ]|[` ]$/.test(code) && code.trim() ? ' ' : '';
      return wrap(start, end, code, fence + space, space + fence);
    }
    case 'link': {
      const label = (selected || '链接文字').replace(/([\\[\]])/g, '\\$1');
      const prefix = `[${label}](`;
      return wrap(start, end, 'https://', prefix, ')');
    }
    case 'codeBlock': {
      const code = selected || '代码';
      const fence = '`'.repeat(Math.max(3, longestBackticks(code) + 1));
      const before = start > 0 && source[start - 1] !== '\n' ? '\n' : '';
      const after = end < source.length && source[end] !== '\n' ? '\n' : '';
      return wrap(start, end, code, before + fence + '\n', (code.endsWith('\n') ? '' : '\n') + fence + after);
    }
    default:
      return formatLines(source, start, end, format, headingLevel);
  }
}

export function markdownReferenceLink(label: string, href: string) {
  const caption = label.replace(/\s+/g, ' ').replace(/[\\[\]`*_~<>!&]/g, '\\$&');
  return `[${caption}](<${href}>)`;
}
