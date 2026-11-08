import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface FocusEditorProps {
  title: string;
  description: string;
  formLabel: string;
  saveLabel: string;
  cancelLabel?: string;
  saveDisabled?: boolean;
  busy?: boolean;
  error?: string;
  onSave: () => void;
  onCancel: () => void;
  children: ReactNode;
}

export default function FocusEditor({
  title, description, formLabel, saveLabel, cancelLabel = '取消编辑', saveDisabled, busy,
  error, onSave, onCancel, children,
}: FocusEditorProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: 'start' });
  }, []);

  return (
    <form className="focus-editor" aria-label={formLabel} onSubmit={(event) => {
      event.preventDefault();
      if (!saveDisabled && !busy) onSave();
    }}>
      <header className="focus-editor-heading">
        <h2 ref={heading} tabIndex={-1}>{title}</h2>
        <p>{description}</p>
      </header>
      {children}
      <footer className="focus-editor-actions">
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="note-button" disabled={saveDisabled || busy}>{busy ? '保存中…' : saveLabel}</button>
        <button type="button" className="note-button secondary" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
      </footer>
    </form>
  );
}
