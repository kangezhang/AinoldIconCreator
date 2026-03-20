import { useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';

/**
 * Flood-fill (paint bucket) tool, executed on the renderer side.
 * Fills a contiguous region of similar colour with the foreground colour
 * (or makes it transparent when fillOptions.mode === 'transparent').
 */
export function useFillTool(overlayCanvasRef: React.RefObject<HTMLCanvasElement>) {
  const store = useEditorStore();

  const getCanvasPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = overlayCanvasRef.current!.getBoundingClientRect();
    const zoom = store.zoom;
    return {
      x: Math.floor((e.clientX - rect.left) / zoom),
      y: Math.floor((e.clientY - rect.top) / zoom),
    };
  }, [store.zoom]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const layer = store.activeLayer();
    if (!layer || layer.locked) return;

    const pt = getCanvasPoint(e);
    const { width, height } = layer.canvas;
    if (pt.x < 0 || pt.x >= width || pt.y < 0 || pt.y >= height) return;

    const ctx = layer.canvas.getContext('2d', { willReadFrequently: true })!;
    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;

    const tolerance = store.fillOptions.tolerance;
    const seedIdx = (pt.y * width + pt.x) * 4;
    const seedR = data[seedIdx];
    const seedG = data[seedIdx + 1];
    const seedB = data[seedIdx + 2];
    const seedA = data[seedIdx + 3];

    const { r: fillR, g: fillG, b: fillB } = store.foregroundColor;
    const fillTransparent = store.fillOptions.mode === 'transparent';

    // BFS flood fill
    const visited = new Uint8Array(width * height);
    const queue: number[] = [];

    const push = (px: number, py: number) => {
      if (px < 0 || px >= width || py < 0 || py >= height) return;
      const i = py * width + px;
      if (visited[i]) return;
      const di = i * 4;
      const dr = Math.abs(data[di] - seedR);
      const dg = Math.abs(data[di + 1] - seedG);
      const db = Math.abs(data[di + 2] - seedB);
      const da = Math.abs(data[di + 3] - seedA);
      if ((dr + dg + db + da) / 4 <= tolerance) {
        visited[i] = 1;
        queue.push(px, py);
      }
    };

    push(pt.x, pt.y);

    while (queue.length > 0) {
      const px = queue.shift()!;
      const py = queue.shift()!;
      const di = (py * width + px) * 4;
      if (fillTransparent) {
        data[di] = 0; data[di + 1] = 0; data[di + 2] = 0; data[di + 3] = 0;
      } else {
        data[di] = fillR; data[di + 1] = fillG; data[di + 2] = fillB; data[di + 3] = 255;
      }
      push(px + 1, py);
      push(px - 1, py);
      push(px, py + 1);
      push(px, py - 1);
    }

    ctx.putImageData(imageData, 0, 0);
    store.commitLayerPixels(layer.id, layer.canvas);
  }, [store, getCanvasPoint]);

  return { onMouseDown };
}
