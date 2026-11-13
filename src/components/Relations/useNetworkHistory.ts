import { useCallback, useRef, useState } from 'react';

export type HistoryDirection = 'undo' | 'redo';

interface NetworkAction {
  label: string;
  undo: () => void;
  redo: () => void;
}

export function useNetworkHistory() {
  const history = useRef<Record<HistoryDirection, NetworkAction[]>>({ undo: [], redo: [] });
  const [available, setAvailable] = useState({ undo: false, redo: false });

  const record = useCallback((action: NetworkAction) => {
    history.current = { undo: [...history.current.undo.slice(-49), action], redo: [] };
    setAvailable({ undo: true, redo: false });
  }, []);

  const run = useCallback((direction: HistoryDirection) => {
    const current = history.current;
    const action = current[direction].at(-1);
    if (!action) return;
    action[direction]();
    const other = direction === 'undo' ? 'redo' : 'undo';
    history.current = { ...current, [direction]: current[direction].slice(0, -1), [other]: [...current[other], action] };
    setAvailable({ undo: history.current.undo.length > 0, redo: history.current.redo.length > 0 });
    return action.label;
  }, []);

  return { available, record, run };
}
