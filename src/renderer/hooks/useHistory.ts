import { useState, useCallback } from 'react';
import type { RgbColor } from '../types';
import type { MaybeSelectionMask } from '../types/selection';

const MAX_HISTORY = 20;

export type OperationType =
  | 'initial'
  | 'load'
  | 'crop'
  | 'removeColorEdge'
  | 'removeColorPoint'
  | 'applySelection';

export interface AppSnapshot {
  image: string | null;
  croppedImage: string | null;
  bgRemovedImage: string | null;
  selectedColor: RgbColor | null;
  tolerance: number;
  selectionMask: MaybeSelectionMask;
  operationType: OperationType;
}

export function useHistory(initial: AppSnapshot) {
  const [past, setPast] = useState<AppSnapshot[]>([]);
  const [future, setFuture] = useState<AppSnapshot[]>([]);

  const saveSnapshot = useCallback((snapshot: AppSnapshot) => {
    setPast(prev => {
      const next = [...prev, snapshot];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });
    setFuture([]);
  }, []);

  const undo = useCallback((current: AppSnapshot): AppSnapshot | null => {
    if (past.length === 0) return null;
    const previous = past[past.length - 1];
    setPast(prev => prev.slice(0, -1));
    setFuture(prev => [current, ...prev]);
    return previous;
  }, [past]);

  const redo = useCallback((current: AppSnapshot): AppSnapshot | null => {
    if (future.length === 0) return null;
    const next = future[0];
    setFuture(prev => prev.slice(1));
    setPast(prev => [...prev, current]);
    return next;
  }, [future]);

  return {
    saveSnapshot,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
