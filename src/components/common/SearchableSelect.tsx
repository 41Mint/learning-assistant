import { useId, useLayoutEffect, useRef, useState } from 'react';
import { matchesWords, searchWords } from '../../utils/resourceSearch';

export default function SearchableSelect({ label, placeholder, options, value, onChange }: {
  label: string;
  placeholder: string;
  options: { id: string; label: string; fields?: string[] }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<string>();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const words = searchWords(query);
  const matches = options.filter(({ label, fields = [] }) => matchesWords([label, ...fields], words));
  const selected = options.find((option) => option.id === value);
  const choices = selected && !words.length ? [{ id: '', label: '清除选择' }, ...matches] : matches;
  const activeIndex = choices.findIndex((option) => option.id === highlight);
  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };
  const show = () => {
    setQuery('');
    setHighlight(value || undefined);
    setOpen(true);
  };

  useLayoutEffect(() => {
    const menu = list.current;
    const field = input.current;
    if (!menu || !field || !open) return;
    const position = () => {
      const rect = field.getBoundingClientRect();
      if (!rect.width || !rect.height) return setOpen(false);
      const below = window.innerHeight - rect.bottom - 8;
      const above = rect.top - 8;
      const flip = below < 160 && above > below;
      menu.style.width = `${rect.width}px`;
      menu.style.left = `${rect.left}px`;
      menu.style.maxHeight = `${Math.min(260, Math.max(60, (flip ? above : below) - 4))}px`;
      menu.style.top = flip ? 'auto' : `${rect.bottom + 4}px`;
      menu.style.bottom = flip ? `${window.innerHeight - rect.top + 4}px` : 'auto';
    };
    menu.showPopover();
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      menu.hidePopover();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (open && activeIndex >= 0) {
      list.current?.querySelector('[data-highlighted]')?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, open]);

  return <div className="searchable-select">
    <label htmlFor={id}>{label}</label>
    <div className="searchable-select-field">
      <input ref={input} id={id} className="workspace-input" type="text" role="combobox" autoComplete="off"
        aria-expanded={open} aria-controls={`${id}-options`} aria-autocomplete="list"
        aria-activedescendant={open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        value={open ? query : selected?.label ?? ''} placeholder={placeholder}
        onFocus={show} onClick={() => { if (!open) show(); }} onBlur={() => setOpen(false)}
        onChange={(event) => {
          setOpen(true);
          setHighlight(undefined);
          setQuery(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) {
              show();
              setHighlight(event.key === 'ArrowDown' ? options[0]?.id : options.at(-1)?.id);
            } else {
              const index = event.key === 'ArrowDown' ? Math.min(choices.length - 1, activeIndex + 1)
                : activeIndex < 0 ? choices.length - 1 : Math.max(0, activeIndex - 1);
              setHighlight(choices[index]?.id);
            }
          } else if (event.key === 'Enter' && open) {
            event.preventDefault();
            const match = choices[activeIndex] ?? (matches.length === 1 ? matches[0] : undefined);
            if (match) choose(match.id);
          }
        }} />
      <span aria-hidden="true" className="searchable-select-chevron">⌄</span>
    </div>
    <div ref={list} popover="manual" className="searchable-select-options" id={`${id}-options`} role="listbox" aria-label={label}>
      {choices.map((option, index) => <div role="option" key={option.id} id={`${id}-option-${index}`}
        aria-selected={option.id === value} data-highlighted={option.id === highlight || undefined}
        onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option.id)}>{option.label}</div>)}
      {matches.length === 0 && <div role="status" className="knowledge-muted">{words.length ? '没有匹配的资料。' : '暂无可选资料。'}</div>}
    </div>
  </div>;
}
