import { useRef, useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';

interface Point { x: number; y: number }

/**
 * Brush tool: paints onto the active layer canvas with configurable
 * size, hardness, opacity and flow.
 *
 * Returns mouse event handlers to attach to the overlay canvas.
 */
export function useBrushTool(overlayCanvasRef: React.RefObject<HTMLCanvasElement>) {
  const store = useEditorStore();
  const painting = useRef(false);
  const lastPoint = useRef<Point | null>(null);
  // Working canvas (the active layer's canvas, borrowed while drawing)
  const workingCanvas = useRef<HTMLCanvasElement | null>(null);
  const workingCtx = useRef<CanvasRenderingContext2D | null>(null);

  const getCanvasPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const rect = overlayCanvasRef.current!.getBoundingClientRect();
    const zoom = store.zoom;
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  }, [store.zoom]);

  const applyBrushDab = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const { size, hardness, opacity, flow } = store.brushOptions;
    const { foregroundColor } = store;
    const radius = size / 2;

    // Create radial gradient to simulate brush hardness
    const gradient = ctx.createRadialGradient(x, y, radius * (hardness / 100) * 0.9, x, y, radius);
    const alpha = (opacity / 100) * (flow / 100);
    const { r, g, b } = foregroundColor;

    gradient.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
    gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, [store.brushOptions, store.foregroundColor]);

  const interpolateDabs = useCallback(
    (ctx: CanvasRenderingContext2D, from: Point, to: Point) => {
      const spacing = Math.max(1, store.brushOptions.size * 0.25);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(1, Math.floor(dist / spacing));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        applyBrushDab(ctx, from.x + dx * t, from.y + dy * t);
      }
    },
    [store.brushOptions.size, applyBrushDab]
  );

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const layer = store.activeLayer();
    if (!layer || layer.locked) return;

    // Snapshot BEFORE any pixels are modified so Ctrl+Z restores the pre-stroke state
    store.pushHistory();

    painting.current = true;
    workingCanvas.current = layer.canvas;
    workingCtx.current = layer.canvas.getContext('2d')!;

    const pt = getCanvasPoint(e);
    lastPoint.current = pt;
    applyBrushDab(workingCtx.current, pt.x, pt.y);

    // Trigger re-render
    store.setActiveTool(store.activeTool);
  }, [store, getCanvasPoint, applyBrushDab]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!painting.current || !workingCtx.current || !lastPoint.current) return;
    const pt = getCanvasPoint(e);
    interpolateDabs(workingCtx.current, lastPoint.current, pt);
    lastPoint.current = pt;
    // Force composite update by triggering a no-op state change
    store.setActiveTool(store.activeTool);
  }, [store, getCanvasPoint, interpolateDabs]);

  const onMouseUp = useCallback((_e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!painting.current || !workingCanvas.current) return;
    painting.current = false;
    const layer = store.activeLayer();
    if (layer) {
      // history was already pushed on mouseDown — skip second push
      store.commitLayerPixels(layer.id, workingCanvas.current, true);
    }
    workingCanvas.current = null;
    workingCtx.current = null;
    lastPoint.current = null;
  }, [store]);

  const onMouseLeave = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    onMouseUp(e);
  }, [onMouseUp]);

  return { onMouseDown, onMouseMove, onMouseUp, onMouseLeave };
}
