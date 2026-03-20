import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type DragHandle =
  | 'body'
  | 'nw' | 'n' | 'ne'
  | 'e'  | 'se' | 's'
  | 'sw' | 'w';

const HANDLE_HIT = 10; // px in document space

/**
 * Crop tool — drag to define a crop rectangle, then press Enter to apply.
 * Esc cancels. Handles on the corners/edges for resizing.
 */
export function useCropTool(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  docWidth: number,
  docHeight: number,
  zoom: number,
) {
  const store = useEditorStore();
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const dragging = useRef<{ handle: DragHandle; startDoc: { x: number; y: number }; startRect: CropRect } | null>(null);

  // ── Keyboard + custom events ──────────────────────────────────────────────
  useEffect(() => {
    if (store.activeTool !== 'crop') return;

    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Enter' && cropRect) {
        e.preventDefault();
        applyCommit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setCropRect(null);
      }
    };
    const onApply = () => applyCommit();
    const onCancel = () => setCropRect(null);
    window.addEventListener('keydown', onKey);
    window.addEventListener('crop-apply', onApply);
    window.addEventListener('crop-cancel', onCancel);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('crop-apply', onApply);
      window.removeEventListener('crop-cancel', onCancel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.activeTool, cropRect]);

  // Reset crop rect when tool is deactivated
  useEffect(() => {
    if (store.activeTool !== 'crop') setCropRect(null);
  }, [store.activeTool]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function toDoc(e: React.MouseEvent): { x: number; y: number } {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  }

  function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v));
  }

  function hitHandle(pt: { x: number; y: number }, r: CropRect): DragHandle {
    const { x, y, width: w, height: h } = r;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const H = HANDLE_HIT;
    // corners
    if (Math.abs(pt.x - x) < H && Math.abs(pt.y - y) < H) return 'nw';
    if (Math.abs(pt.x - (x + w)) < H && Math.abs(pt.y - y) < H) return 'ne';
    if (Math.abs(pt.x - x) < H && Math.abs(pt.y - (y + h)) < H) return 'sw';
    if (Math.abs(pt.x - (x + w)) < H && Math.abs(pt.y - (y + h)) < H) return 'se';
    // edges
    if (Math.abs(pt.x - x) < H && pt.y >= y && pt.y <= y + h) return 'w';
    if (Math.abs(pt.x - (x + w)) < H && pt.y >= y && pt.y <= y + h) return 'e';
    if (Math.abs(pt.y - y) < H && pt.x >= x && pt.x <= x + w) return 'n';
    if (Math.abs(pt.y - (y + h)) < H && pt.x >= x && pt.x <= x + w) return 's';
    // body
    if (pt.x >= x && pt.x <= x + w && pt.y >= y && pt.y <= y + h) return 'body';
    return 'body'; // fallback — start new drag
  }

  function applyCommit() {
    if (!cropRect) return;
    const { x, y, width, height } = cropRect;
    if (width < 1 || height < 1) return;
    store.applyCrop(x, y, width, height);
    setCropRect(null);
    store.setActiveTool('none');
  }

  // ── Mouse handlers ────────────────────────────────────────────────────────

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const pt = toDoc(e);
    if (cropRect) {
      const handle = hitHandle(pt, cropRect);
      dragging.current = { handle, startDoc: pt, startRect: { ...cropRect } };
    } else {
      // Start a new drag
      dragging.current = {
        handle: 'se',
        startDoc: pt,
        startRect: { x: pt.x, y: pt.y, width: 0, height: 0 },
      };
      setCropRect({ x: pt.x, y: pt.y, width: 0, height: 0 });
    }
    e.preventDefault();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropRect, zoom]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const pt = toDoc(e);
    const { handle, startDoc, startRect } = dragging.current;
    const dx = pt.x - startDoc.x;
    const dy = pt.y - startDoc.y;
    let { x, y, width, height } = startRect;

    switch (handle) {
      case 'body':
        x = clamp(x + dx, 0, docWidth - width);
        y = clamp(y + dy, 0, docHeight - height);
        break;
      case 'se':
        width  = clamp(startRect.width + dx, 1, docWidth - x);
        height = clamp(startRect.height + dy, 1, docHeight - y);
        break;
      case 'nw': {
        const newX = clamp(x + dx, 0, x + width - 1);
        const newY = clamp(y + dy, 0, y + height - 1);
        width += x - newX; height += y - newY; x = newX; y = newY;
        break;
      }
      case 'ne': {
        const newY = clamp(y + dy, 0, y + height - 1);
        width  = clamp(startRect.width + dx, 1, docWidth - x);
        height += y - newY; y = newY;
        break;
      }
      case 'sw': {
        const newX = clamp(x + dx, 0, x + width - 1);
        width += x - newX; x = newX;
        height = clamp(startRect.height + dy, 1, docHeight - y);
        break;
      }
      case 'n': {
        const newY = clamp(y + dy, 0, y + height - 1);
        height += y - newY; y = newY;
        break;
      }
      case 's':
        height = clamp(startRect.height + dy, 1, docHeight - y);
        break;
      case 'w': {
        const newX = clamp(x + dx, 0, x + width - 1);
        width += x - newX; x = newX;
        break;
      }
      case 'e':
        width = clamp(startRect.width + dx, 1, docWidth - x);
        break;
    }
    setCropRect({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docWidth, docHeight, zoom]);

  const onMouseUp = useCallback(() => {
    dragging.current = null;
  }, []);

  return {
    cropRect,
    applyCommit,
    cancelCrop: () => setCropRect(null),
    handlers: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp },
  };
}
