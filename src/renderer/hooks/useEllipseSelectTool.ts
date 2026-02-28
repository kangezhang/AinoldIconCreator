import { useRef, useState } from 'react';
import type { SelectionToolParams, CanvasRect } from '../types/selection';
import { createEmptyMask, fillEllipseMask, normalizeRect, clampRect } from '../utils/maskUtils';
import { getCanvasPoint } from '../utils/canvasUtils';

export function useEllipseSelectTool({ isActive, canvasRef, imageSize, onCommit }: SelectionToolParams) {
  const isDragging = useRef(false);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const [previewRect, setPreviewRect] = useState<CanvasRect | null>(null);

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isActive || !canvasRef.current) return;
    const pt = getCanvasPoint(e, canvasRef.current);
    isDragging.current = true;
    startPoint.current = pt;
    setPreviewRect({ x: pt.x, y: pt.y, width: 0, height: 0 });
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isActive || !isDragging.current || !startPoint.current || !canvasRef.current) return;
    const pt = getCanvasPoint(e, canvasRef.current);
    setPreviewRect(normalizeRect(startPoint.current, pt));
  };

  const onMouseUp = () => {
    if (!isActive || !isDragging.current || !previewRect) return;
    isDragging.current = false;
    if (previewRect.width > 1 && previewRect.height > 1) {
      const clamped = clampRect(previewRect, imageSize);
      const mask = createEmptyMask(imageSize.width, imageSize.height);
      const cx = clamped.x + clamped.width / 2;
      const cy = clamped.y + clamped.height / 2;
      fillEllipseMask(mask, cx, cy, clamped.width / 2, clamped.height / 2);
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
