import { useRef, useState } from 'react';

/** Shared immutable document history for diagrams, drawings and formation edits. */
export function useHistory<T>(initial: T) {
  const [value, setValue] = useState(initial);
  const current = useRef(value);
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);
  function checkpoint() {
    const snapshot = current.current;
    setPast((p) => [...p.slice(-79), snapshot]);
    setFuture([]);
  }
  function change(next: T, remember = true) {
    if (remember) checkpoint();
    current.current = next;
    setValue(next);
  }
  function undo() {
    const previous = past[past.length - 1];
    if (previous === undefined) return;
    const snapshot = current.current;
    setFuture((f) => [snapshot, ...f]);
    setPast((p) => p.slice(0, -1));
    change(previous, false);
  }
  function redo() {
    const next = future[0];
    if (next === undefined) return;
    const snapshot = current.current;
    setPast((p) => [...p, snapshot]);
    setFuture((f) => f.slice(1));
    change(next, false);
  }
  return {
    value,
    change,
    checkpoint,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
