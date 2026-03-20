import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { drawMaskOverlay } from '../../utils/maskUtils';
import { useBrushTool } from '../../hooks/useBrushTool';
import { useEraserTool } from '../../hooks/useEraserTool';
import { useFillTool } from '../../hooks/useFillTool';
import { useRectSelectTool } from '../../hooks/useRectSelectTool';
import { useEllipseSelectTool } from '../../hooks/useEllipseSelectTool';
import { useLassoSelectTool } from '../../hooks/useLassoSelectTool';
import { usePaintSelectTool } from '../../hooks/usePaintSelectTool';
import { useMoveTool } from '../../hooks/useMoveTool';
import { useCropTool } from '../../hooks/useCropTool';
import type { SelectionMask } from '../../types';

interface CanvasOverlayProps {
  docWidth: number;
  docHeight: number;
  zoom: number;
}

/**
 * Transparent overlay positioned on top of the composite canvas.
 * Receives all mouse events and dispatches to the active tool hook.
 * Also renders selection mask, crop rect, and tool previews.
 */
const CanvasOverlay: React.FC<CanvasOverlayProps> = ({ docWidth, docHeight, zoom }) => {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const selectionOverlayRef = useRef<HTMLCanvasElement | null>(null);
  // Brush/eraser circle cursor state (client coords relative to the overlay wrapper)
  const [brushCursor, setBrushCursor] = useState<{ x: number; y: number } | null>(null);

  const store = useEditorStore();
  const {
    activeTool, selectionMask, selectionMode,
    setSelectionMask, setActiveTool,
  } = store;

  const imageSize = { width: docWidth, height: docHeight };

  const onCommit = useCallback((mask: SelectionMask) => {
    const current = store.selectionMask;
    const mode = store.selectionMode;
    if (mode === 'replace' || !current) {
      setSelectionMask(mask);
      return;
    }
    const result = new Uint8ClampedArray(mask.data.length);
    for (let i = 0; i < mask.data.length; i++) {
      if (mode === 'add') result[i] = Math.min(255, current.data[i] + mask.data[i]);
      else result[i] = Math.max(0, current.data[i] - mask.data[i]);
    }
    setSelectionMask({ data: result, width: mask.width, height: mask.height });
  }, [store.selectionMask, store.selectionMode, setSelectionMask]);

  // ── Tool hooks ──────────────────────────────────────────────────────────
  const brushHandlers   = useBrushTool(overlayRef);
  const eraserHandlers  = useEraserTool(overlayRef);
  const fillHandlers    = useFillTool(overlayRef);
  const rectSelect    = useRectSelectTool({ isActive: activeTool === 'rectSelect',    canvasRef: overlayRef, imageSize, selectionMode, onCommit, zoom });
  const ellipseSelect = useEllipseSelectTool({ isActive: activeTool === 'ellipseSelect', canvasRef: overlayRef, imageSize, selectionMode, onCommit, zoom });
  const lassoSelect   = useLassoSelectTool({ isActive: activeTool === 'lassoSelect',  canvasRef: overlayRef, imageSize, selectionMode, onCommit, zoom });
  const paintSelect   = usePaintSelectTool({ isActive: activeTool === 'paintSelect',  canvasRef: overlayRef, imageSize, selectionMode, onCommit, zoom });
  const moveTool      = useMoveTool(zoom);
  const cropTool      = useCropTool(overlayRef, docWidth, docHeight, zoom);

  // ── Overlay render ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    if (canvas.width !== docWidth) canvas.width = docWidth;
    if (canvas.height !== docHeight) canvas.height = docHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, docWidth, docHeight);

    // Selection mask (blue tint)
    drawMaskOverlay(ctx, selectionMask, 30, 120, 255, 180, selectionOverlayRef);

    // Selection tool previews
    if (activeTool === 'rectSelect' && rectSelect.previewRect) {
      drawDashedRect(ctx, rectSelect.previewRect);
    }
    if (activeTool === 'ellipseSelect' && ellipseSelect.previewRect) {
      drawDashedEllipse(ctx, ellipseSelect.previewRect);
    }
    if (activeTool === 'lassoSelect' && lassoSelect.lassoPoints.length > 1) {
      drawLassoPath(ctx, lassoSelect.lassoPoints);
    }
    if (activeTool === 'paintSelect' && paintSelect.previewMask) {
      drawMaskOverlay(ctx, paintSelect.previewMask, 0, 200, 100, 160, undefined);
    }

    // Crop rect
    if (activeTool === 'crop' && cropTool.cropRect) {
      drawCropRect(ctx, cropTool.cropRect, docWidth, docHeight);
    }
  }, [
    selectionMask, activeTool, docWidth, docHeight,
    rectSelect.previewRect, ellipseSelect.previewRect,
    lassoSelect.lassoPoints, paintSelect.previewMask,
    cropTool.cropRect,
  ]);

  // ── Cursor style ────────────────────────────────────────────────────────
  const hasBrushCircle = activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'paintSelect';

  const getCursor = () => {
    if (hasBrushCircle) return 'none'; // hidden — custom circle rendered below
    switch (activeTool) {
      case 'fill':
      case 'colorPick':
      case 'pointErase':
      case 'rectSelect':
      case 'ellipseSelect':
      case 'lassoSelect':
      case 'crop': return 'crosshair';
      case 'hand': return 'grab';
      case 'zoom': return 'zoom-in';
      case 'move': return 'move';
      default: return 'default';
    }
  };

  // ── Dispatch mouse events to active tool ──────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    switch (activeTool) {
      case 'brush':         brushHandlers.onMouseDown(e); return;
      case 'eraser':        eraserHandlers.onMouseDown(e); return;
      case 'fill':          fillHandlers.onMouseDown(e); return;
      case 'rectSelect':    rectSelect.handlers.onMouseDown(e); return;
      case 'ellipseSelect': ellipseSelect.handlers.onMouseDown(e); return;
      case 'lassoSelect':   lassoSelect.handlers.onMouseDown(e); return;
      case 'paintSelect':   paintSelect.handlers.onMouseDown(e); return;
      case 'move':          moveTool.onMouseDown(e); return;
      case 'crop':          cropTool.handlers.onMouseDown(e); return;
      case 'zoom': {
        // Click to zoom in; Alt+click to zoom out
        if (e.altKey) store.zoomOut(); else store.zoomIn();
        return;
      }
      case 'colorPick': {
        const canvas = overlayRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) / zoom);
        const y = Math.round((e.clientY - rect.top) / zoom);
        const layer = store.activeLayer();
        if (layer) {
          const ctx = layer.canvas.getContext('2d', { willReadFrequently: true })!;
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          store.setForegroundColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
        }
        setActiveTool('none');
        return;
      }
      case 'pointErase': {
        const canvas = overlayRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) / zoom);
        const y = Math.round((e.clientY - rect.top) / zoom);
        handlePointErase(x, y);
        return;
      }
    }
  }, [activeTool, brushHandlers, eraserHandlers, fillHandlers, rectSelect, ellipseSelect, lassoSelect, paintSelect, moveTool, cropTool, store, zoom, setActiveTool]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Update brush circle cursor position (screen coords relative to the canvas element)
    if (hasBrushCircle) {
      const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
      setBrushCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    switch (activeTool) {
      case 'brush':         brushHandlers.onMouseMove(e); return;
      case 'eraser':        eraserHandlers.onMouseMove(e); return;
      case 'rectSelect':    rectSelect.handlers.onMouseMove(e); return;
      case 'ellipseSelect': ellipseSelect.handlers.onMouseMove(e); return;
      case 'lassoSelect':   lassoSelect.handlers.onMouseMove(e); return;
      case 'paintSelect':   paintSelect.handlers.onMouseMove(e); return;
      case 'move':          moveTool.onMouseMove(e); return;
      case 'crop':          cropTool.handlers.onMouseMove(e); return;
    }
  }, [activeTool, hasBrushCircle, brushHandlers, eraserHandlers, rectSelect, ellipseSelect, lassoSelect, paintSelect, moveTool, cropTool]);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    switch (activeTool) {
      case 'brush':         brushHandlers.onMouseUp(e); return;
      case 'eraser':        eraserHandlers.onMouseUp(e); return;
      case 'rectSelect':    rectSelect.handlers.onMouseUp(e); return;
      case 'ellipseSelect': ellipseSelect.handlers.onMouseUp(e); return;
      case 'lassoSelect':   lassoSelect.handlers.onMouseUp(e); return;
      case 'paintSelect':   paintSelect.handlers.onMouseUp(e); return;
      case 'move':          moveTool.onMouseUp(e); return;
      case 'crop':          cropTool.handlers.onMouseUp(e); return;
    }
  }, [activeTool, brushHandlers, eraserHandlers, rectSelect, ellipseSelect, lassoSelect, paintSelect, moveTool, cropTool]);

  const onMouseLeave = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setBrushCursor(null); // hide circle when mouse exits canvas
    switch (activeTool) {
      case 'brush':         brushHandlers.onMouseLeave(e); return;
      case 'eraser':        eraserHandlers.onMouseLeave(e); return;
      case 'rectSelect':    rectSelect.handlers.onMouseLeave?.(e); return;
      case 'ellipseSelect': ellipseSelect.handlers.onMouseLeave?.(e); return;
      case 'lassoSelect':   lassoSelect.handlers.onMouseLeave?.(e); return;
      case 'paintSelect':   paintSelect.handlers.onMouseLeave?.(e); return;
      case 'move':          moveTool.onMouseLeave(e); return;
      case 'crop':          cropTool.handlers.onMouseLeave(e); return;
    }
  }, [activeTool, brushHandlers, eraserHandlers, rectSelect, ellipseSelect, lassoSelect, paintSelect, moveTool, cropTool]);

  // Point erase via IPC (Sharp)
  const handlePointErase = useCallback(async (x: number, y: number) => {
    const doc = store.document;
    const layer = store.activeLayer();
    if (!doc || !layer) return;
    if (!window.electronAPI?.removeColorAtPoint) return;

    const dataUrl = layer.canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    const tolerance = Math.round(store.fillOptions.tolerance);
    const result = await window.electronAPI.removeColorAtPoint(base64, x, y, tolerance);
    if (result.success && result.imageBase64) {
      const img = new Image();
      img.onload = () => {
        const ctx = layer.canvas.getContext('2d')!;
        ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        ctx.drawImage(img, 0, 0);
        store.commitLayerPixels(layer.id, layer.canvas);
      };
      img.src = `data:image/png;base64,${result.imageBase64}`;
    }
    setActiveTool('none');
  }, [store, setActiveTool]);

  // Compute brush circle diameter in screen pixels
  const brushScreenRadius = (() => {
    if (activeTool === 'brush') return (store.brushOptions.size / 2) * zoom;
    if (activeTool === 'eraser') return (store.eraserOptions.size / 2) * zoom;
    if (activeTool === 'paintSelect') return 12 * zoom; // paint select fixed radius
    return 0;
  })();

  return (
    <>
      <canvas
        ref={overlayRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: docWidth * zoom,
          height: docHeight * zoom,
          cursor: getCursor(),
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      />

      {/* Brush / eraser circle cursor overlay */}
      {hasBrushCircle && brushCursor && brushScreenRadius > 0 && (
        <div
          style={{
            position: 'absolute',
            left: brushCursor.x - brushScreenRadius,
            top: brushCursor.y - brushScreenRadius,
            width: brushScreenRadius * 2,
            height: brushScreenRadius * 2,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.8)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  );
};

export default CanvasOverlay;

// ── Drawing helpers ──────────────────────────────────────────────────────────

function drawDashedRect(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number }
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineDashOffset = 5;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

function drawDashedEllipse(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number }
) {
  if (rect.width < 2 || rect.height < 2) return;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rect.width / 2, rect.height / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineDashOffset = 5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rect.width / 2, rect.height / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawLassoPath(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineDashOffset = 5;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.restore();
}

function drawCropRect(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  docW: number,
  docH: number,
) {
  const { x, y, width: w, height: h } = rect;

  // Dim the area outside the crop
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  // Top
  ctx.fillRect(0, 0, docW, y);
  // Bottom
  ctx.fillRect(0, y + h, docW, docH - (y + h));
  // Left
  ctx.fillRect(0, y, x, h);
  // Right
  ctx.fillRect(x + w, y, docW - (x + w), h);

  // Crop border
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.strokeRect(x, y, w, h);

  // Rule-of-thirds grid
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 0.5;
  for (let i = 1; i < 3; i++) {
    const gx = x + (w / 3) * i;
    const gy = y + (h / 3) * i;
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
  }

  // Corner handles
  const HS = 6;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const corners = [
    [x, y], [x + w, y], [x, y + h], [x + w, y + h],
  ];
  for (const [cx, cy] of corners) {
    ctx.fillRect(cx - HS / 2, cy - HS / 2, HS, HS);
  }

  ctx.restore();
}
