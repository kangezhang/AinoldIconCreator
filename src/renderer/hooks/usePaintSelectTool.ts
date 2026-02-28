import { useRef, useState } from 'react';
import type { MaybeSelectionMask, SelectionToolParams } from '../types/selection';
import { createEmptyMask, paintBrushMask } from '../utils/maskUtils';
import { getCanvasPoint } from '../utils/canvasUtils';

const BRUSH_RADIUS = 12;

export function usePaintSelectTool({ isActive, canvasRef, imageSize, onCommit }: SelectionToolParams) {
  const isPainting = useRef(false);
  const localMask = useRef<ReturnType<typeof createEmptyMask> | null>(null);
  const [previewMask, setPreviewMask] = useState<MaybeSelectionMask>(null);

  const paint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !localMask.current) return;
    const pt = getCanvasPoint(e, canvasRef.current);
    paintBrushMask(localMask.current, pt.x, pt.y, BRUSH_RADIUS);
    // Shallow copy data to trigger re-render
    setPreviewMask({
      data: localMask.current.data.slice(),
      width: localMask.current.width,
      height: localMask.current.height,
    });
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isActive || !canvasRef.current) return;
    isPainting.current = true;
    localMask.current = createEmptyMask(imageSize.width, imageSize.height);
    paint(e);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isActive || !isPainting.current) return;
    paint(e);
  };

  const onMouseUp = () => {
    if (!isActive || !isPainting.current || !localMask.current) return;
    isPainting.current = false;
    onCommit(localMask.current);
    localMask.current = null;
    setPreviewMask(null);
  };

  const onMouseLeave = () => {
    if (isPainting.current) onMouseUp();
  };

  return {
    handlers: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave },
    previewMask,
  };
}
