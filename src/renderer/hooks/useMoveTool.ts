import { useCallback, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';

/**
 * Move tool — drags the active layer's (x, y) offset.
 * Snapshots history on mouse-down (before moving) so the drag is undoable.
 */
export function useMoveTool(zoom: number) {
  const store = useEditorStore();
  const isDragging = useRef(false);
  const startClient = useRef({ x: 0, y: 0 });
  const startLayerPos = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const layer = store.activeLayer();
    if (!layer) return;
    // Snapshot pre-move state so drag is undoable
    store.pushHistory();
    isDragging.current = true;
    startClient.current = { x: e.clientX, y: e.clientY };
    startLayerPos.current = { x: layer.x, y: layer.y };
    e.preventDefault();
  }, [store]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const layer = store.activeLayer();
    if (!layer) return;
    const dx = (e.clientX - startClient.current.x) / zoom;
    const dy = (e.clientY - startClient.current.y) / zoom;
    store._moveActiveLayer(
      Math.round(startLayerPos.current.x + dx),
      Math.round(startLayerPos.current.y + dy),
    );
  }, [store, zoom]);

  const finish = useCallback(() => {
    isDragging.current = false;
  }, []);

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp: finish,
    onMouseLeave: finish,
  };
}
