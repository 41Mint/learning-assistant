export type HistoryDirection = 'undo' | 'redo';

export function historyShortcut(event: KeyboardEvent): HistoryDirection | undefined {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.defaultPrevented || event.isComposing) return;
  if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable], [role="textbox"]')) return;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && !event.shiftKey) return 'redo';
}
