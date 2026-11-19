import { useId, useRef, useState } from 'react';
import HighlightedText from '../common/HighlightedText';

export default function LogMetadataField({ label, sectionLabel = label, placeholder, items, onAdd, onRemove, onRename, searchWords }: {
  label: string;
  sectionLabel?: string;
  placeholder: string;
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  onRename?: (previous: string, next: string) => void;
  searchWords?: string[];
}) {
  const id = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{ item: string; draft: string }>();
  const focusTag = useRef<string>(undefined);
  const modify = (action: () => void) => {
    try {
      action();
      setError('');
    } catch {
      setError('保存失败，请重试。');
    }
  };
  const startEditing = (item: string) => {
    setError('');
    setEditing({ item, draft: item });
  };
  const stopEditing = (focus?: string) => {
    focusTag.current = focus;
    setEditing(undefined);
    setError('');
  };
  const rename = () => {
    if (!editing || !onRename) return;
    const next = editing.draft.trim();
    if (!next || (next !== editing.item && items.includes(next))) {
      setError(next ? '已有同名标签。' : '标签不能为空。');
      return;
    }
    modify(() => {
      if (next !== editing.item) onRename(editing.item, next);
      stopEditing(next);
    });
  };
  return <section className="log-metadata-field" aria-label={sectionLabel}>
    <label htmlFor={id}>{label}</label>
    {items.length > 0 && <ul className="log-chips" aria-label={label}>{items.map((item) => <li className="log-chip" key={item}>
      {editing?.item === item ? <input type="text" className="workspace-input log-chip-input"
        aria-label={`编辑${label}「${item}」`} aria-invalid={Boolean(error)}
        aria-describedby={error ? id + '-error' : undefined}
        autoFocus value={editing.draft} onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          setEditing({ item, draft: event.target.value });
          setError('');
        }}
        onBlur={() => stopEditing()}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === 'Enter') {
            event.preventDefault();
            rename();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            stopEditing(item);
          }
        }} />
        : onRename ? <button type="button" className="log-chip-title" aria-label={`编辑${label}「${item}」`}
          title="双击编辑标签" ref={(button) => {
            if (button && focusTag.current === item) {
              focusTag.current = undefined;
              button.focus({ preventScroll: true });
            }
          }}
          onDoubleClick={() => startEditing(item)}
          onClick={(event) => {
            const native = event.nativeEvent;
            if (event.detail === 0 || (native instanceof PointerEvent && native.pointerType === 'touch')) startEditing(item);
          }}><HighlightedText text={item} words={searchWords} /></button>
        : <span><HighlightedText text={item} words={searchWords} /></span>}
      <button className="log-chip-remove" type="button" aria-label={`移除${label}「${item}」`}
        onClick={() => modify(() => onRemove(item))}>×</button>
    </li>)}</ul>}
    <form className="log-metadata-form" data-preserves-on-navigation onSubmit={(event) => {
      event.preventDefault();
      const text = value.trim();
      if (text) modify(() => { onAdd(text); setValue(''); });
    }}>
      <input id={id} className="workspace-input" type="text" value={value} placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)} />
      <button type="submit" className="workspace-button" disabled={!value.trim()} aria-label={`添加${label}`}>添加</button>
    </form>
    {error && <p id={id + '-error'} className="log-metadata-error" role="alert">{error}</p>}
  </section>;
}
