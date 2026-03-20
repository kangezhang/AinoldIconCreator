import { useRef, useState } from 'react';
import type { SelectionToolParams } from '../types/selection';
import { createEmptyMask, fillPolygonMask } from '../utils/maskUtils';
import { getCanvasPoint } from '../utils/canvasUtils';

export function useLassoSelectTool({ isActive, canvasRef, imageSize, onCommit, zoom = 1 }: SelectionToolParams) {
  const isDrawing = useRef(false);
  const [lassoPoints, setLassoPoints] = useState<Array<{ x: number; y: number }>>([]);

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isActive || !canvasRef.current) return;
    isDrawing.current = true;
    const pt = getCanvasPoint(e, canvasRef.current, zoom);
    setLassoPoints([pt]);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isActive || !isDrawing.current || !canvasRef.current) return;
    const pt = getCanvasPoint(e, canvasRef.current, zoom);
    setLassoPoints(prev => {
      const last = prev[prev.length - 1];
      if (!last) return [pt];
      const dist = Math.hypot(pt.x - last.x, pt.y - last.y);
      if (dist < 3) return prev;
      return [...prev, pt];
    });
  };

  const onMouseUp = () => {
    if (!isActive || !isDrawing.current) return;
    isDrawing.current = false;
    setLassoPoints(prev => {
      if (prev.length >= 3) {
        const mask = createEmptyMask(imageSize.width, imageSize.height);
        fillPolygonMask(mask, [...prev, prev[0]]);
        onCommit(mask);
      }
      return [];
    });
  };

  const onMouseLeave = () => {
    if (isDrawing.current) onMouseUp();
  };

  return {
    handlers: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave },
    lassoPoints,
  };
}
