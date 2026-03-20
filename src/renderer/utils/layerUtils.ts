import type { Layer, CanvasDocument, LayerSnapshot, DocumentSnapshot } from '../types';

/** CSS blend mode string (Canvas 2D globalCompositeOperation) */
export function blendModeToCss(mode: Layer['blendMode']): GlobalCompositeOperation {
  // Canvas 2D uses the same strings as CSS blend modes for most values
  return mode as GlobalCompositeOperation;
}

/** Create a blank off-screen canvas */
export function createLayerCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Deep-copy a single layer canvas */
export function cloneLayerCanvas(layer: Layer): HTMLCanvasElement {
  const copy = createLayerCanvas(layer.canvas.width, layer.canvas.height);
  const ctx = copy.getContext('2d')!;
  ctx.drawImage(layer.canvas, 0, 0);
  return copy;
}

/**
 * Composite all visible layers onto a destination canvas.
 * Layers are ordered bottom-to-top (index 0 = bottom).
 */
export function flattenLayers(
  layers: Layer[],
  docWidth: number,
  docHeight: number,
  dest?: HTMLCanvasElement,
): HTMLCanvasElement {
  const out = dest ?? createLayerCanvas(docWidth, docHeight);
  if (out.width !== docWidth || out.height !== docHeight) {
    out.width = docWidth;
    out.height = docHeight;
  }
  const ctx = out.getContext('2d')!;
  ctx.clearRect(0, 0, docWidth, docHeight);

  for (const layer of layers) {
    if (!layer.visible) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity / 100;
    ctx.globalCompositeOperation = blendModeToCss(layer.blendMode);
    ctx.drawImage(layer.canvas, layer.x, layer.y);
    ctx.restore();
  }

  return out;
}

/** Merge layer `sourceId` down onto the layer below it in the stack. */
export function mergeDown(doc: CanvasDocument, sourceId: string): CanvasDocument {
  const idx = doc.layers.findIndex(l => l.id === sourceId);
  if (idx <= 0) return doc; // nothing below

  const above = doc.layers[idx];
  const below = doc.layers[idx - 1];

  const merged = createLayerCanvas(doc.width, doc.height);
  const ctx = merged.getContext('2d')!;

  // Draw below first
  ctx.save();
  ctx.globalAlpha = below.opacity / 100;
  ctx.globalCompositeOperation = blendModeToCss(below.blendMode);
  ctx.drawImage(below.canvas, below.x, below.y);
  ctx.restore();

  // Draw above on top
  ctx.save();
  ctx.globalAlpha = above.opacity / 100;
  ctx.globalCompositeOperation = blendModeToCss(above.blendMode);
  ctx.drawImage(above.canvas, above.x, above.y);
  ctx.restore();

  const mergedLayer: Layer = {
    ...below,
    canvas: merged,
    opacity: 100,
    blendMode: 'normal',
  };

  const newLayers = doc.layers.filter((_, i) => i !== idx && i !== idx - 1);
  newLayers.splice(idx - 1, 0, mergedLayer);

  return {
    ...doc,
    layers: newLayers,
    activeLayerId: mergedLayer.id,
  };
}

/** Flatten the entire document into a single layer. */
export function flattenAll(doc: CanvasDocument): CanvasDocument {
  if (doc.layers.length === 0) return doc;

  const flatCanvas = flattenLayers(doc.layers, doc.width, doc.height);
  const flatLayer: Layer = {
    id: doc.layers[0].id,
    name: 'Background',
    type: 'raster',
    visible: true,
    locked: false,
    opacity: 100,
    blendMode: 'normal',
    canvas: flatCanvas,
    x: 0,
    y: 0,
  };

  return {
    ...doc,
    layers: [flatLayer],
    activeLayerId: flatLayer.id,
  };
}

// ── Snapshot serialisation (for undo/redo) ────────────────────────────────────

export function snapshotDocument(doc: CanvasDocument): DocumentSnapshot {
  return {
    ...doc,
    layers: doc.layers.map(l => ({
      id: l.id,
      name: l.name,
      type: l.type,
      visible: l.visible,
      locked: l.locked,
      opacity: l.opacity,
      blendMode: l.blendMode,
      dataUrl: l.canvas.toDataURL('image/png'),
      x: l.x,
      y: l.y,
    })),
  };
}

export async function restoreDocument(snap: DocumentSnapshot): Promise<CanvasDocument> {
  const layers = await Promise.all(
    snap.layers.map(ls => restoreLayer(ls, snap.width, snap.height))
  );
  return { ...snap, layers };
}

async function restoreLayer(ls: LayerSnapshot, docW: number, docH: number): Promise<Layer> {
  return new Promise((resolve) => {
    const canvas = createLayerCanvas(docW, docH);
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      resolve({
        id: ls.id,
        name: ls.name,
        type: ls.type,
        visible: ls.visible,
        locked: ls.locked,
        opacity: ls.opacity,
        blendMode: ls.blendMode,
        canvas,
        x: ls.x,
        y: ls.y,
      });
    };
    img.src = ls.dataUrl;
  });
}
