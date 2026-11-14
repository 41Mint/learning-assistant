import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export default function GrowthBoardDialog({ title, action, children, valid = true, onSave, onClose }: {
  title: string;
  action: string;
  children: ReactNode;
  valid?: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState('');
  useLayoutEffect(() => { dialog.current?.showModal(); }, []);
  const close = () => {
    dialog.current?.close();
    onClose();
  };
  return <dialog ref={dialog} className="growth-board-dialog" aria-label={title} onCancel={(event) => {
    event.preventDefault();
    close();
  }}>
    <form data-preserves-on-navigation onSubmit={(event) => {
      event.preventDefault();
      if (!valid) return;
      try {
        onSave();
        close();
      } catch (error) {
        setError(error instanceof Error ? error.message : '操作失败，请重试。');
      }
    }}>
      <h2>{title}</h2>
      {children}
      {error && <p role="alert">{error}</p>}
      <div className="code-actions">
        <button type="submit" className="note-button" disabled={!valid}>{action}</button>
        <button type="button" className="note-button secondary" onClick={close}>取消</button>
      </div>
    </form>
  </dialog>;
}
