import type { HistoryDirection } from '../../utils/workspaceHistory';

const controls = {
  undo: { path: 'M9 5 4 10l5 5M4 10h10a5 5 0 0 1 0 10h-3', title: '撤销 · Ctrl+Z', keys: 'Control+Z Meta+Z' },
  redo: { path: 'm15 5 5 5-5 5M20 10H10a5 5 0 0 0 0 10h3', title: '重做 · Ctrl+Shift+Z', keys: 'Control+Shift+Z Meta+Shift+Z Control+Y' },
};

export default function HistoryButtons({ available, labels, onHistory, disabled }: {
  available: Record<HistoryDirection, boolean>;
  labels: Record<HistoryDirection, string>;
  onHistory: (direction: HistoryDirection) => void;
  disabled?: boolean;
}) {
  return <>{(['undo', 'redo'] as const).map((direction) => {
    const { path, title, keys } = controls[direction];
    return <button key={direction} type="button" className="workspace-icon-button" aria-label={labels[direction]} title={title}
      aria-keyshortcuts={keys} disabled={disabled || !available[direction]} onClick={() => onHistory(direction)}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
    </button>;
  })}</>;
}
