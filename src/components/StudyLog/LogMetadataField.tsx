import { useId, useState } from 'react';
import HighlightedText from '../common/HighlightedText';

export default function LogMetadataField({ label, sectionLabel = label, placeholder, items, onAdd, onRemove, searchWords }: {
  label: string;
  sectionLabel?: string;
  placeholder: string;
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  searchWords?: string[];
}) {
  const id = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const modify = (action: () => void) => {
    try {
      action();
      setError('');
    } catch {
      setError('保存失败，请重试。');
    }
  };
  return <section className="log-metadata-field" aria-label={sectionLabel}>
    <label htmlFor={id}>{label}</label>
    {items.length > 0 && <ul className="log-chips" aria-label={label}>{items.map((item) => <li className="log-chip" key={item}>
      <span><HighlightedText text={item} words={searchWords} /></span>
      <button type="button" aria-label={`移除${label}「${item}」`}
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
    {error && <p className="log-metadata-error" role="alert">{error}</p>}
  </section>;
}
