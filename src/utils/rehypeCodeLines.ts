import type { Element, Root } from 'hast';

function splitLines(children: Element['children']): Element['children'][] {
  const lines: Element['children'][] = [[]];
  for (const child of children) {
    if (child.type === 'text') {
      child.value.split('\n').forEach((value, index) => {
        if (index) lines.push([]);
        if (value) lines.at(-1)!.push({ type: 'text', value });
      });
    } else if (child.type === 'element') {
      splitLines(child.children).forEach((part, index) => {
        if (index) lines.push([]);
        if (part.length) lines.at(-1)!.push({ ...child, children: part });
      });
    }
  }
  return lines;
}

export function rehypeCodeLines(firstLine = 1) {
  return (root: Root) => {
    for (const child of root.children) {
      if (child.type !== 'element' || child.tagName !== 'pre') continue;
      const code = child.children.find((node): node is Element => node.type === 'element' && node.tagName === 'code');
      if (!code) continue;
      const lines = splitLines(code.children);
      if (lines.length > 1 && lines.at(-1)?.length === 0) lines.pop();
      code.children = lines.flatMap((children, index): Element['children'] => [{
        type: 'element', tagName: 'span', properties: { className: ['script-line'], dataCodeLine: index + firstLine }, children,
      }, ...(index < lines.length - 1 ? [{ type: 'text' as const, value: '\n' }] : [])]);
    }
  };
}
