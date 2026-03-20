import { useCallback, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';

interface Point { x: number; y: number }

/**
 * Channel paint tool — paints grayscale onto the active custom channel canvas.
 * White = fully selected, black = transparent.
 * Only active when editingChannel=true and activeChannelId is a custom channel.
 */
export function useChannelPaintTool(
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>,
  zoom: number,
) {
  const store = useEditorStore();
  const painting = useRef(false);
  const lastPoint = useRef<Point | null>(null);

  const getPoint = useCallback((e: React.MouseEvent): Point => {
    const rect = overlayCanvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  }, [overlayCanvasRef, zoom]);

  const getChannelCtx = useCallback((): CanvasRenderingContext2D | null => {
    const { channelState } = store;
    const ch = channelState.customChannels.find(c => c.id === channelState.activeChannelId);
    if (!ch) return null;
    return ch.canvas.getContext('2d')!;
  }, [store]);

  const applyDab = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, erase: boolean) => {
    const { size, hardness, opacity, flow } = store.brushOptions;
    const radius = size / 2;
    const alpha = (opacity / 100) * (flow / 100);

    const gradient = ctx.createRadialGradient(x, y, radius * (hardness / 100) * 0.9, x, y, radius);
    const v = erase ? 0 : 255;
    gradient.addColorStop(0, `rgba(${v},${v},${v},${alpha})`);
    gradient.addColorStop(1, `rgba(${v},${v},${v},0)`);

    ctx.save();
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, [store.brushOptions]);

  const interpolate = useCallback((ctx: CanvasRenderingContext2D, from: Point, to: Point, erase: boolean) => {
    const spacing = Math.max(1, store.brushOptions.size * 0.25);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.floor(dist / spacing));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      applyDab(ctx, from.x + dx * t, from.y + dy * t, erase);
    }
  }, [store.brushOptions.size, applyDab]);

  const onMouseDown = useCallback((e: React.MouseEvent, erase = false) => {
    const ctx = getChannelCtx();
    if (!ctx) return;
    store.pushHistory();
    painting.current = true;
    const pt = getPoint(e);
    lastPoint.current = pt;
    applyDab(ctx, pt.x, pt.y, erase);
    // Force re-render
    store.setActiveTool(store.activeTool);
  }, [store, getPoint, getChannelCtx, applyDab]);

  const onMouseMove = useCallback((e: React.MouseEvent, erase = false) => {
    if (!painting.current || !lastPoint.current) return;
    const ctx = getChannelCtx();
    if (!ctx) return;
    const pt = getPoint(e);
    interpolate(ctx, lastPoint.current, pt, erase);
    lastPoint.current = pt;
    store.setActiveTool(store.activeTool);
  }, [store, getPoint, getChannelCtx, interpolate]);

  const onMouseUp = useCallback(() => {
    painting.current = false;
    lastPoint.current = null;
  }, []);

  return { onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp };
}
