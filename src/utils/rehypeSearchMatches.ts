import type { Element, Root, Text } from 'hast';
import { splitMatches, textMatches } from './searchMatches';

const inlineTags = new Set(['a', 'code', 'del', 'em', 'i', 'span', 'strong', 'sub', 'sup']);

export function rehypeSearchMatches(words: string[]) {
  return (root: Root) => {
    const nodes: { parent: Root | Element; index: number; value: string; start: number }[] = [];
    const text: string[] = [];
    let length = 0;
    const append = (value: string) => {
      text.push(value);
      length += value.length;
    };

    // Read inline text together so a match can cross spans created by syntax highlighting.
    const visit = (parent: Root | Element) => parent.children.forEach((child, index) => {
      if (child.type === 'text') {
        nodes.push({ parent, index, value: child.value, start: length });
        append(child.value);
      } else if (child.type === 'element') {
        const block = !inlineTags.has(child.tagName);
        if (block) append('\n');
        visit(child);
        if (block) append('\n');
      }
    });
    visit(root);

    const ranges = textMatches(text.join(''), words);
    let current = ranges.length - 1;
    for (let index = nodes.length - 1; index >= 0 && current >= 0; index -= 1) {
      const { parent, index: childIndex, value, start } = nodes[index];
      const end = start + value.length;
      while (current >= 0 && ranges[current].start >= end) current -= 1;
      const local = [];
      for (let hit = current; hit >= 0 && ranges[hit].end > start; hit -= 1) {
        local.push({ start: Math.max(0, ranges[hit].start - start), end: Math.min(value.length, ranges[hit].end - start) });
      }
      if (!local.length) continue;
      const parts = splitMatches(value, local.reverse()).map(({ text, matched }): Text | Element => {
        const child: Text = { type: 'text', value: text };
        return matched ? { type: 'element', tagName: 'mark', properties: { className: ['search-match'] }, children: [child] } : child;
      });
      parent.children.splice(childIndex, 1, ...parts);
    }
  };
}
