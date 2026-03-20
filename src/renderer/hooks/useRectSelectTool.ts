import { useRef, useState } from 'react';
import type { SelectionToolParams, CanvasRect } from '../types/selection';
import { createEmptyMask, fillRectMask, normalizeRect, clampRect } from '../utils/maskUtils';
import { getCanvasPoint } from '../utils/canvasUtils';

export function useRectSelectTool({ isActive, canvasRef, imageSize, onCommit, zoom = 1 }: SelectionToolParams) {
  const isDragging = useRef(false);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const [previewRect, setPreviewRect] = useState<CanvasRect | null>(null);

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isActive || !canvasRef.current) return;
    const pt = getCanvasPoint(e, canvasRef.current, zoom);
    isDragging.current = true;
    startPoint.current = pt;
    setPreviewRect({ x: pt.x, y: pt.y, width: 0, height: 0 });
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isActive || !isDragging.current || !startPoint.current || !canvasRef.current) return;
    const pt = getCanvasPoint(e, canvasRef.current, zoom);
    setPreviewRect(normalizeRect(startPoint.current, pt));
  };

  const onMouseUp = () => {
    if (!isActive || !isDragging.current || !previewRect) return;
    isDragging.current = false;
    if (previewRect.width > 1 && previewRect.height > 1) {
      const mask = createEmptyMask(imageSize.width, imageSize.height);
      const clamped = clampRect(previewRect, imageSize);
      fillRectMask(mask, clamped.x, clamped.y, clamped.width, clamped.height);
      onCommit(mask);
    }
    setPreviewRect(null);
    startPoint.current = null;
  };

  const onMouseLeave = () => {
    if (isDragging.current) onMouseUp();
  };

  return {
    handlers: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave },
    previewRect,
  };
}
