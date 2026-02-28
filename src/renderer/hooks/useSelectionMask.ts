import { useState, useCallback } from 'react';
import type { MaybeSelectionMask, SelectionMask, SelectionMode } from '../types/selection';
import { createEmptyMask, mergeMasks } from '../utils/maskUtils';

export function useSelectionMask() {
  const [selectionMask, setSelectionMask] = useState<MaybeSelectionMask>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('replace');

  const commitToolResult = useCallback((toolMask: SelectionMask) => {
    setSelectionMask(prev => {
      if (prev === null || selectionMode === 'replace') return toolMask;
      return mergeMasks(prev, toolMask, selectionMode);
    });
  }, [selectionMode]);

  const clearSelection = useCallback(() => setSelectionMask(null), []);

  const selectAll = useCallback((width: number, height: number) => {
    const mask = createEmptyMask(width, height);
    mask.data.fill(255);
    setSelectionMask(mask);
  }, []);

  return {
    selectionMask,
    setSelectionMask,
    selectionMode,
    setSelectionMode,
    commitToolResult,
    clearSelection,
    selectAll,
  };
}
