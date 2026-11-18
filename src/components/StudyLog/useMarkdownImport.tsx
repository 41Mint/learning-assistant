import { useRef, useState } from 'react';
import MarkdownImport from './MarkdownImport';

export default function useMarkdownImport({ initialDate, onOpen, onImported }: {
  initialDate?: string;
  onOpen?: () => void;
  onImported: (date: string, imageCount: number) => void;
}) {
  const [importing, setImporting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setImporting(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  };

  return {
    trigger: <button ref={triggerRef} type="button" className="workspace-button log-import-trigger" aria-haspopup="dialog" onClick={() => {
      onOpen?.();
      setImporting(true);
    }}>导入图文学习记录</button>,
    dialog: importing && <MarkdownImport initialDate={initialDate} onClose={close} onImported={(date, imageCount) => {
      onImported(date, imageCount);
      close();
    }} />,
  };
}
