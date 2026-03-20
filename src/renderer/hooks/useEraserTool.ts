import { useRef, useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';

interface Point { x: number; y: number }

export function useEraserTool(overlayCanvasRef: React.RefObject<HTMLCanvasElement>) {
  const store = useEditorStore();
  const painting = useRef(false);
  const lastPoint = useRef<Point | null>(null);
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

  const applyEraserDab = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const { size, hardness, opacity, flow } = store.eraserOptions;
    const radius = size / 2;
    const alpha = (opacity / 100) * (flow / 100);

    const gradient = ctx.createRadialGradient(x, y, radius * (hardness / 100) * 0.9, x, y, radius);
    gradient.addColorStop(0, `rgba(0,0,0,${alpha})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, [store.eraserOptions]);

  const interpolateDabs = useCallback(
    (ctx: CanvasRenderingContext2D, from: Point, to: Point) => {
      const spacing = Math.max(1, store.eraserOptions.size * 0.25);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(1, Math.floor(dist / spacing));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        applyEraserDab(ctx, from.x + dx * t, from.y + dy * t);
      }
    },
    [store.eraserOptions.size, applyEraserDab]
  );

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const layer = store.activeLayer();
    if (!layer || layer.locked) return;
    // Snapshot BEFORE pixels are modified so Ctrl+Z restores the pre-stroke state
    store.pushHistory();
    painting.current = true;
    workingCanvas.current = layer.canvas;
    workingCtx.current = layer.canvas.getContext('2d')!;
    const pt = getCanvasPoint(e);
    lastPoint.current = pt;
    applyEraserDab(workingCtx.current, pt.x, pt.y);
    store.setActiveTool(store.activeTool);
  }, [store, getCanvasPoint, applyEraserDab]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!painting.current || !workingCtx.current || !lastPoint.current) return;
    const pt = getCanvasPoint(e);
    interpolateDabs(workingCtx.current, lastPoint.current, pt);
    lastPoint.current = pt;
    store.setActiveTool(store.activeTool);
  }, [store, getCanvasPoint, interpolateDabs]);

  const onMouseUp = useCallback((_e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!painting.current || !workingCanvas.current) return;
    painting.current = false;
    const layer = store.activeLayer();
    // history was already pushed on mouseDown — skip second push
    if (layer) store.commitLayerPixels(layer.id, workingCanvas.current, true);
    workingCanvas.current = null;
    workingCtx.current = null;
    lastPoint.current = null;
  }, [store]);

  const onMouseLeave = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    onMouseUp(e);
  }, [onMouseUp]);

  return { onMouseDown, onMouseMove, onMouseUp, onMouseLeave };
}
