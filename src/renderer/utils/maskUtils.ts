import type { SelectionMask, SelectionMode, MaybeSelectionMask, CanvasRect } from '../types/selection';

export function createEmptyMask(width: number, height: number): SelectionMask {
  return { data: new Uint8ClampedArray(width * height), width, height };
}

export function isMaskEmpty(mask: SelectionMask): boolean {
  for (let i = 0; i < mask.data.length; i++) {
    if (mask.data[i] > 0) return false;
  }
  return true;
}

export function fillRectMask(
  mask: SelectionMask,
  x: number, y: number, w: number, h: number
): void {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(mask.width, Math.round(x + w));
  const y1 = Math.min(mask.height, Math.round(y + h));
  for (let row = y0; row < y1; row++) {
    for (let col = x0; col < x1; col++) {
      mask.data[row * mask.width + col] = 255;
    }
  }
}

export function fillEllipseMask(
  mask: SelectionMask,
  cx: number, cy: number, rx: number, ry: number
): void {
  if (rx <= 0 || ry <= 0) return;
  const y0 = Math.max(0, Math.ceil(cy - ry));
  const y1 = Math.min(mask.height - 1, Math.floor(cy + ry));
  for (let row = y0; row <= y1; row++) {
    const dy = (row - cy) / ry;
    const xSpan = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
    const col0 = Math.max(0, Math.ceil(cx - xSpan));
    const col1 = Math.min(mask.width - 1, Math.floor(cx + xSpan));
    for (let col = col0; col <= col1; col++) {
      mask.data[row * mask.width + col] = 255;
    }
  }
}

export function fillPolygonMask(
  mask: SelectionMask,
  points: Array<{ x: number; y: number }>
): void {
  if (points.length < 3) return;
  const { width, height } = mask;

  const yMin = Math.max(0, Math.floor(Math.min(...points.map(p => p.y))));
  const yMax = Math.min(height - 1, Math.ceil(Math.max(...points.map(p => p.y))));

  for (let row = yMin; row <= yMax; row++) {
    const intersections: number[] = [];
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const a = points[i];
      const b = points[(i + 1) % n];
      if ((a.y <= row && b.y > row) || (b.y <= row && a.y > row)) {
        const t = (row - a.y) / (b.y - a.y);
        intersections.push(a.x + t * (b.x - a.x));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let k = 0; k + 1 < intersections.length; k += 2) {
      const col0 = Math.max(0, Math.ceil(intersections[k]));
      const col1 = Math.min(width - 1, Math.floor(intersections[k + 1]));
      for (let col = col0; col <= col1; col++) {
        mask.data[row * width + col] = 255;
      }
    }
  }
}

export function paintBrushMask(
  mask: SelectionMask,
  cx: number, cy: number, radius: number
): void {
  fillEllipseMask(mask, cx, cy, radius, radius);
}

export function mergeMasks(
  a: SelectionMask,
  b: SelectionMask,
  mode: SelectionMode
): SelectionMask {
  const result = createEmptyMask(b.width, b.height);
  const len = result.data.length;
  if (mode === 'replace') {
    result.data.set(b.data);
  } else if (mode === 'add') {
    for (let i = 0; i < len; i++) {
      result.data[i] = Math.min(255, (a.data[i] ?? 0) + b.data[i]);
    }
  } else {
    // subtract
    for (let i = 0; i < len; i++) {
      result.data[i] = Math.max(0, (a.data[i] ?? 0) - b.data[i]);
    }
  }
  return result;
}

/**
 * Scale a canvas-space mask to image-space dimensions (nearest-neighbor).
 * Returns a new mask sized to imgWidth x imgHeight.
 */
export function scaleMaskToImage(
  canvasMask: SelectionMask,
  imgWidth: number,
  imgHeight: number
): SelectionMask {
  const result = createEmptyMask(imgWidth, imgHeight);
  const scaleX = canvasMask.width / imgWidth;
  const scaleY = canvasMask.height / imgHeight;
  for (let imgY = 0; imgY < imgHeight; imgY++) {
    for (let imgX = 0; imgX < imgWidth; imgX++) {
      const maskX = Math.min(canvasMask.width - 1, Math.floor(imgX * scaleX));
      const maskY = Math.min(canvasMask.height - 1, Math.floor(imgY * scaleY));
      result.data[imgY * imgWidth + imgX] = canvasMask.data[maskY * canvasMask.width + maskX];
    }
  }
  return result;
}

export function normalizeRect(
  start: { x: number; y: number },
  end: { x: number; y: number }
): CanvasRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function clampRect(rect: CanvasRect, size: { width: number; height: number }): CanvasRect {
  const x = Math.max(0, rect.x);
  const y = Math.max(0, rect.y);
  return {
    x, y,
    width: Math.min(size.width - x, rect.width),
    height: Math.min(size.height - y, rect.height),
  };
}

/** Render a SelectionMask as a colored overlay onto a canvas context. */
export function drawMaskOverlay(
  ctx: CanvasRenderingContext2D,
  mask: MaybeSelectionMask,
  r: number, g: number, b: number, a: number,
  overlayCanvasRef: { current: HTMLCanvasElement | null }
): void {
  if (!mask) return;
  // Reuse or create offscreen canvas
  if (!overlayCanvasRef.current) {
    overlayCanvasRef.current = document.createElement('canvas');
  }
  const oc = overlayCanvasRef.current;
  if (oc.width !== mask.width || oc.height !== mask.height) {
    oc.width = mask.width;
    oc.height = mask.height;
  }
  const octx = oc.getContext('2d')!;
  const imgData = octx.createImageData(mask.width, mask.height);
  for (let i = 0; i < mask.data.length; i++) {
    const v = mask.data[i];
    if (v > 0) {
      imgData.data[i * 4 + 0] = r;
      imgData.data[i * 4 + 1] = g;
      imgData.data[i * 4 + 2] = b;
      imgData.data[i * 4 + 3] = Math.round(a * (v / 255));
    }
  }
  octx.putImageData(imgData, 0, 0);
  ctx.drawImage(oc, 0, 0);
}
