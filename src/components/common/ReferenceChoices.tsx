import { useState } from 'react';
import { matchesWords, searchWords } from '../../utils/resourceSearch';

interface ReferenceChoicesProps {
  title: string;
  options: { id: string; label: string; fields?: string[] }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  emptyText?: string;
}

export default function ReferenceChoices({ title, options, selected, onChange, emptyText = '暂无可选记录。' }: ReferenceChoicesProps) {
  const [query, setQuery] = useState('');
  const words = searchWords(query);
  const optionIds = new Set(options.map((option) => option.id));
  const unavailable = selected.filter((id) => !optionIds.has(id)).map((id) => ({ id, label: '原记录已不可用' }));
  const allChoices: ReferenceChoicesProps['options'] = [...options, ...unavailable];
  const choices = words.length ? allChoices.filter(({ label, fields = [] }) => matchesWords([label, ...fields], words)) : allChoices;

  return (
    <details className="reference-choices">
      <summary>{title}（{selected.length}）</summary>
      {options.length > 0 && (
        <input className="search-input" type="search" aria-label={'筛选' + title} placeholder="按关键词筛选"
          value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.preventDefault();
          }} />
      )}
      <div className="reference-options" role="group" aria-label={title}>
        {choices.length === 0 && <p className="growth-muted">{words.length ? '没有匹配的资料。' : emptyText}</p>}
        {choices.map(({ id, label }) => (
          <label key={id}>
            <input type="checkbox" checked={selected.includes(id)} onChange={(event) => {
              onChange(event.target.checked ? [...selected, id] : selected.filter((value) => value !== id));
            }} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
