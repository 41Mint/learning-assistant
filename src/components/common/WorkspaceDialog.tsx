import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export default function WorkspaceDialog({ title, action, children, valid = true, destructive, onSave, onClose }: {
  title: string;
  action: string;
  children: ReactNode;
  valid?: boolean;
  destructive?: boolean;
  onSave: () => void | Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useLayoutEffect(() => {
    dialog.current?.showModal();
    if (destructive) cancelButton.current?.focus({ preventScroll: true });
  }, [destructive]);
  const close = () => {
    dialog.current?.close();
    onClose();
  };
  return <dialog ref={dialog} className="workspace-dialog" aria-label={title} onCancel={(event) => {
    event.preventDefault();
    if (!submitting.current) close();
  }}>
    <form data-preserves-on-navigation onSubmit={(event) => {
      event.preventDefault();
      if (!valid || submitting.current) return;
      submitting.current = true;
      setBusy(true);
      setError('');
      void (async () => {
        try {
          await onSave();
          close();
        } catch (error) {
          setError(error instanceof Error ? error.message : '操作失败，请重试。');
        } finally {
          submitting.current = false;
          setBusy(false);
        }
      })();
    }}>
      <h2>{title}</h2>
      {children}
      {error && <p role="alert">{error}</p>}
      <div className="code-actions">
        <button type="submit" className="note-button" disabled={!valid || busy}>{action}</button>
        <button ref={cancelButton} type="button" className="note-button secondary" disabled={busy} onClick={close}>取消</button>
      </div>
    </form>
  </dialog>;
}
