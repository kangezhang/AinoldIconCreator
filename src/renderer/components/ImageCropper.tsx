import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef
} from 'react';
import type { ActiveTool, MaybeSelectionMask, SelectionMask, SelectionMode, CanvasRect } from '../types/selection';
import type { RgbColor } from '../types';
import { drawMaskOverlay } from '../utils/maskUtils';
import { getCanvasPoint, canvasToImageCoords, pickColorAtCanvas } from '../utils/canvasUtils';
import { useRectSelectTool } from '../hooks/useRectSelectTool';
import { useEllipseSelectTool } from '../hooks/useEllipseSelectTool';
import { useLassoSelectTool } from '../hooks/useLassoSelectTool';
import { usePaintSelectTool } from '../hooks/usePaintSelectTool';

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedImage: string) => void;
  activeTool: ActiveTool;
  selectionMask: MaybeSelectionMask;
  selectionMode: SelectionMode;
  onToolCommit: (mask: SelectionMask) => void;
  onColorPick?: (color: RgbColor) => void;
  onPendingChange?: (pending: boolean) => void;
  onPointErase?: (imageX: number, imageY: number) => void;
  onImageSizeChange?: (width: number, height: number) => void;
}

type DragMode = 'move' | 'resize' | null;

export interface ImageCropperHandle {
  applyCrop: () => void;
}

const ImageCropper = forwardRef<ImageCropperHandle, ImageCropperProps>(({
  image,
  onCropComplete,
  activeTool,
  selectionMask,
  selectionMode,
  onToolCommit,
  onColorPick,
  onPendingChange,
  onPointErase,
  onImageSizeChange,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectionOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const previewOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const imgRef = useRef<HTMLImageElement>(new Image());

  const isCropping = activeTool === 'crop';

  const updatePending = useCallback((pending: boolean) => {
    onPendingChange?.(pending);
  }, [onPendingChange]);

  // --- Selection tool hooks ---
  const rectSelect = useRectSelectTool({ isActive: activeTool === 'rectSelect', canvasRef, imageSize, selectionMode, onCommit: onToolCommit });
  const ellipseSelect = useEllipseSelectTool({ isActive: activeTool === 'ellipseSelect', canvasRef, imageSize, selectionMode, onCommit: onToolCommit });
  const lassoSelect = useLassoSelectTool({ isActive: activeTool === 'lassoSelect', canvasRef, imageSize, selectionMode, onCommit: onToolCommit });
  const paintSelect = usePaintSelectTool({ isActive: activeTool === 'paintSelect', canvasRef, imageSize, selectionMode, onCommit: onToolCommit });

  // --- Image load ---
  useEffect(() => {
    const img = imgRef.current;
    img.crossOrigin = 'anonymous';
    img.src = image;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
      if (!ctx) return;

      const maxWidth = 500;
      const maxHeight = 500;
      let width = img.width;
      let height = img.height;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = width * ratio;
        height = height * ratio;
      }
      canvas.width = width;
      canvas.height = height;
      setImageSize({ width, height });
      onImageSizeChange?.(width, height);

      if (!sampleCanvasRef.current) {
        sampleCanvasRef.current = document.createElement('canvas');
      }
      const sc = sampleCanvasRef.current;
      sc.width = img.width;
      sc.height = img.height;
      const sctx = sc.getContext('2d', { willReadFrequently: true });
      if (sctx) {
        sctx.clearRect(0, 0, img.width, img.height);
        sctx.drawImage(img, 0, 0, img.width, img.height);
      }

      const size = Math.min(width, height);
      const x = (width - size) / 2;
      const y = (height - size) / 2;
      const initialCrop = { x, y, width: size, height: size };
      setCrop(initialCrop);
      updatePending(false);
      performCrop(initialCrop, { width, height });
    };
  }, [image, updatePending]);

  // --- Consolidated render effect ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSize.width) return;
    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    if (!ctx) return;

    // Layer 1: base image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);

    // Layer 2: crop overlay
    if (isCropping) {
      drawCropOverlay(ctx, crop, canvas.width, canvas.height);
    }

    // Layer 3: committed selection mask (blue)
    drawMaskOverlay(ctx, selectionMask, 30, 120, 255, 180, selectionOverlayRef);

    // Layer 4: tool previews
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
      drawMaskOverlay(ctx, paintSelect.previewMask, 0, 200, 100, 160, previewOverlayRef);
    }

    // Cursor
    if (activeTool === 'colorPick' || activeTool === 'pointErase') {
      canvas.style.cursor = 'crosshair';
    } else if (['rectSelect', 'ellipseSelect', 'lassoSelect', 'paintSelect'].includes(activeTool)) {
      canvas.style.cursor = activeTool === 'paintSelect' ? 'cell' : 'crosshair';
    } else if (!isCropping) {
      canvas.style.cursor = 'default';
    }
  }, [
    activeTool, isCropping, crop, imageSize,
    selectionMask,
    rectSelect.previewRect,
    ellipseSelect.previewRect,
    lassoSelect.lassoPoints,
    paintSelect.previewMask,
  ]);

  // --- Crop helpers ---
  const isInsideCrop = (x: number, y: number) =>
    x >= crop.x && x <= crop.x + crop.width && y >= crop.y && y <= crop.y + crop.height;

  const isNearEdge = (x: number, y: number) => {
    const threshold = 15;
    const right = crop.x + crop.width;
    const bottom = crop.y + crop.height;
    return (
      (Math.abs(x - right) < threshold && Math.abs(y - bottom) < threshold) ||
      (Math.abs(x - right) < threshold && y >= crop.y && y <= bottom) ||
      (Math.abs(y - bottom) < threshold && x >= crop.x && x <= right)
    );
  };

  // --- Unified mouse dispatcher ---
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasPoint(e, canvas);

    switch (activeTool) {
      case 'colorPick':
        if (onColorPick && sampleCanvasRef.current) {
          const color = pickColorAtCanvas(x, y, imageSize, imgRef.current, sampleCanvasRef.current);
          if (color) onColorPick(color);
        }
        return;
      case 'pointErase':
        if (onPointErase) {
          const coords = canvasToImageCoords(x, y, imageSize, imgRef.current);
          if (coords) onPointErase(coords.x, coords.y);
        }
        return;
      case 'rectSelect':    rectSelect.handlers.onMouseDown(e); return;
      case 'ellipseSelect': ellipseSelect.handlers.onMouseDown(e); return;
      case 'lassoSelect':   lassoSelect.handlers.onMouseDown(e); return;
      case 'paintSelect':   paintSelect.handlers.onMouseDown(e); return;
      case 'crop': {
        if (isNearEdge(x, y)) setDragMode('resize');
        else if (isInsideCrop(x, y)) setDragMode('move');
        else return;
        setDragStart({ x, y });
        setCropStart({ ...crop });
        return;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasPoint(e, canvas);

    switch (activeTool) {
      case 'rectSelect':    rectSelect.handlers.onMouseMove(e); return;
      case 'ellipseSelect': ellipseSelect.handlers.onMouseMove(e); return;
      case 'lassoSelect':   lassoSelect.handlers.onMouseMove(e); return;
      case 'paintSelect':   paintSelect.handlers.onMouseMove(e); return;
      case 'crop': {
        if (!dragMode) {
          if (isNearEdge(x, y)) canvas.style.cursor = 'nwse-resize';
          else if (isInsideCrop(x, y)) canvas.style.cursor = 'move';
          else canvas.style.cursor = 'default';
          return;
        }
        const deltaX = x - dragStart.x;
        const deltaY = y - dragStart.y;
        let newCrop = { ...crop };
        if (dragMode === 'move') {
          newCrop.x = Math.max(0, Math.min(imageSize.width - crop.width, cropStart.x + deltaX));
          newCrop.y = Math.max(0, Math.min(imageSize.height - crop.height, cropStart.y + deltaY));
        } else {
          const delta = Math.max(deltaX, deltaY);
          let newSize = Math.max(50, Math.min(Math.min(imageSize.width, imageSize.height), cropStart.width + delta));
          newCrop.width = newSize;
          newCrop.height = newSize;
          if (newCrop.x + newCrop.width > imageSize.width) { newCrop.width = imageSize.width - newCrop.x; newCrop.height = newCrop.width; }
          if (newCrop.y + newCrop.height > imageSize.height) { newCrop.height = imageSize.height - newCrop.y; newCrop.width = newCrop.height; }
        }
        setCrop(newCrop);
        updatePending(true);
        return;
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    switch (activeTool) {
      case 'rectSelect':    rectSelect.handlers.onMouseUp(e); return;
      case 'ellipseSelect': ellipseSelect.handlers.onMouseUp(e); return;
      case 'lassoSelect':   lassoSelect.handlers.onMouseUp(e); return;
      case 'paintSelect':   paintSelect.handlers.onMouseUp(e); return;
      case 'crop':
        if (dragMode) setDragMode(null);
        return;
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLCanvasElement>) => {
    switch (activeTool) {
      case 'rectSelect':    rectSelect.handlers.onMouseLeave?.(e); return;
      case 'ellipseSelect': ellipseSelect.handlers.onMouseLeave?.(e); return;
      case 'lassoSelect':   lassoSelect.handlers.onMouseLeave?.(e); return;
      case 'paintSelect':   paintSelect.handlers.onMouseLeave?.(e); return;
      case 'crop':
        if (dragMode) setDragMode(null);
        return;
    }
  };

  // --- Crop execution ---
  const performCrop = (
    cropArea = crop,
    canvasSize = imageSize
  ) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const tempCanvas = document.createElement('canvas');
    const size = 1024;
    tempCanvas.width = size;
    tempCanvas.height = size;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    const scaleX = img.width / canvasSize.width;
    const scaleY = img.height / canvasSize.height;
    ctx.drawImage(img, cropArea.x * scaleX, cropArea.y * scaleY, cropArea.width * scaleX, cropArea.height * scaleY, 0, 0, size, size);
    onCropComplete(tempCanvas.toDataURL('image/png').split(',')[1]);
  };

  const applyCrop = useCallback(() => {
    if (!imageSize.width || !imageSize.height) return;
    performCrop(crop, imageSize);
    updatePending(false);
  }, [crop, imageSize, updatePending]);

  useImperativeHandle(ref, () => ({ applyCrop }), [applyCrop]);

  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className="checkerboard border border-gray-300 rounded max-w-full"
      />
    </div>
  );
});

export default ImageCropper;

// --- Canvas drawing helpers ---

function drawCropOverlay(
  ctx: CanvasRenderingContext2D,
  crop: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number
) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.clearRect(crop.x, crop.y, crop.width, crop.height);
  ctx.restore();

  // Checkerboard inside crop
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  const tile = 16;
  for (let y = Math.floor(crop.y / tile) * tile; y < crop.y + crop.height; y += tile) {
    for (let x = Math.floor(crop.x / tile) * tile; x < crop.x + crop.width; x += tile) {
      const isDark = (Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0;
      ctx.fillStyle = isDark ? '#f1f5f9' : '#e2e8f0';
      ctx.fillRect(Math.max(crop.x, x), Math.max(crop.y, y), Math.min(tile, crop.x + crop.width - x), Math.min(tile, crop.y + crop.height - y));
    }
  }
  ctx.restore();

  ctx.strokeStyle = '#4F46E5';
  ctx.lineWidth = 2;
  ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);
}

function drawDashedRect(ctx: CanvasRenderingContext2D, rect: CanvasRect) {
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

function drawDashedEllipse(ctx: CanvasRenderingContext2D, rect: CanvasRect) {
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
