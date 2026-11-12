import type { ReactNode } from 'react';

export default function KnowledgeDirectory<T extends { id: string; title: string }>({ items, categoryOf, selectedCategory, expandAll, renderEntry }: {
  items: T[];
  categoryOf: (item: T) => string;
  selectedCategory?: string;
  expandAll?: boolean;
  renderEntry: (item: T) => ReactNode;
}) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const category = categoryOf(item);
    const group = groups.get(category) ?? [];
    group.push(item);
    groups.set(category, group);
  }

  return <div className="knowledge-directory">
    {[...groups].sort(([a], [b]) => (a || '未分类').localeCompare(b || '未分类', 'zh-CN')).map(([category, group]) => (
      <details key={category} open={expandAll || groups.size === 1 || selectedCategory === category || undefined}>
        <summary>{category || '未分类'}（{group.length}）</summary>
        <ul className="knowledge-entry-list">
          {group.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN')).map((item) => <li key={item.id}>{renderEntry(item)}</li>)}
        </ul>
      </details>
    ))}
  </div>;
}
