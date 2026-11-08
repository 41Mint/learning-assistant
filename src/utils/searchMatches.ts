interface MatchRange {
  start: number;
  end: number;
}

const graphemes = new Intl.Segmenter();
const MAX_HIGHLIGHTS = 500;

function mergeRanges(ranges: MatchRange[]): MatchRange[] {
  const result: MatchRange[] = [];
  for (const range of ranges) {
    const last = result.at(-1);
    if (last && range.start < last.end) last.end = Math.max(last.end, range.end);
    else result.push(range);
  }
  return result;
}

export function textMatches(text: string, words: string[], firstOnly = false): MatchRange[] {
  if (!text || !words.length) return [];
  const composed = text.normalize('NFKC');
  const normalized = composed.toLocaleLowerCase();
  const limit = firstOnly ? 1 : MAX_HIGHLIGHTS;
  const ranges: MatchRange[] = [];
  for (const word of words) {
    if (!word) continue;
    let start = normalized.indexOf(word);
    for (let count = 0; count < limit && start >= 0; count += 1) {
      ranges.push({ start, end: start + word.length });
      start = normalized.indexOf(word, start + word.length);
    }
  }
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const matches = mergeRanges(ranges.slice(0, limit));
  if (!matches.length || (composed === text && normalized.length === text.length)) return matches;

  // NFKC can expand a ligature or combine accented characters. Mark complete original graphemes.
  const original: MatchRange[] = [];
  let offset = 0;
  let current = 0;
  let start = 0;
  for (const { segment, index } of graphemes.segment(text)) {
    const nextOffset = offset + segment.normalize('NFKC').toLocaleLowerCase().length;
    while (current < matches.length && matches[current].start < nextOffset) {
      if (matches[current].start >= offset) start = index;
      if (matches[current].end > nextOffset) break;
      original.push({ start, end: index + segment.length });
      current += 1;
    }
    if (current === matches.length) break;
    offset = nextOffset;
  }
  return mergeRanges(original);
}

export function splitMatches(text: string, ranges: MatchRange[]) {
  const parts: { text: string; matched: boolean }[] = [];
  let offset = 0;
  for (const { start, end } of ranges) {
    if (start > offset) parts.push({ text: text.slice(offset, start), matched: false });
    parts.push({ text: text.slice(start, end), matched: true });
    offset = end;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset), matched: false });
  return parts;
}

export function matchExcerpt(fields: string[], words: string[]): string {
  for (const field of fields) {
    const text = field.replace(/\s+/g, ' ').trim();
    const [match] = textMatches(text, words, true);
    if (!match) continue;
    const start = Math.max(0, match.start - 24);
    const end = Math.min(text.length, Math.max(start + 100, match.end));
    return (start ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }
  return '';
}

export function matchScriptLine(content: string, words: string[]) {
  const [match] = textMatches(content, words, true);
  if (!match) return undefined;
  const lines = content.slice(0, match.start).split(/\r\n|\r|\n/);
  const rest = content.slice(match.start).split(/\r\n|\r|\n/, 1)[0];
  return { line: lines.length, excerpt: matchExcerpt([lines.at(-1) + rest], words) };
}
