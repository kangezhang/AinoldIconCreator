import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  CanvasDocument,
  Layer,
  ActiveTool,
  SelectionMask,
  SelectionMode,
  BrushOptions,
  EraserOptions,
  FillOptions,
  RgbColor,
  DocumentSnapshot,
  BuiltinChannelId,
  CustomChannel,
  ChannelState,
} from '../types';
import {
  createLayerCanvas,
  flattenLayers,
  mergeDown as mergeDownUtil,
  flattenAll as flattenAllUtil,
  snapshotDocument,
  restoreDocument,
} from '../utils/layerUtils';

// ── History ──────────────────────────────────────────────────────────────────

const MAX_HISTORY = 30;

interface HistoryState {
  past: DocumentSnapshot[];
  future: DocumentSnapshot[];
}

// ── Editor State ─────────────────────────────────────────────────────────────

export interface EditorState {
  document: CanvasDocument | null;

  // View
  zoom: number;
  panOffset: { x: number; y: number };
  cursorPos: { x: number; y: number };

  // Tool
  activeTool: ActiveTool;
  prevTool: ActiveTool; // for temporary tool switches (e.g. space→hand)

  // Selection
  selectionMask: SelectionMask | null;
  selectionMode: SelectionMode;

  // Colour
  foregroundColor: RgbColor;
  backgroundColor: RgbColor;

  // Tool options
  brushOptions: BrushOptions;
  eraserOptions: EraserOptions;
  fillOptions: FillOptions;

  // Undo/Redo
  _history: HistoryState;

  // Channels
  channelState: ChannelState;

  // ── Computed helpers (inline so components can call without selectors) ──────
  activeLayer: () => Layer | null;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // ── Document actions ─────────────────────────────────────────────────────
  newDocument: (width: number, height: number, name?: string) => void;
  openImage: (dataUrl: string, name?: string) => void;
  closeDocument: () => void;

  // ── Layer actions ─────────────────────────────────────────────────────────
  addLayer: (name?: string, below?: string) => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;
  setLayerVisibility: (id: string, visible: boolean) => void;
  setLayerLocked: (id: string, locked: boolean) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  setLayerBlendMode: (id: string, mode: Layer['blendMode']) => void;
  renameLayer: (id: string, name: string) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  mergeDown: (id: string) => void;
  flattenAll: () => void;
  /** Write pixels back to a layer canvas. Pass skipHistory=true when history was already pushed before the operation. */
  commitLayerPixels: (layerId: string, canvas: HTMLCanvasElement, skipHistory?: boolean) => void;
  /** Move active layer position in real-time (no history push) */
  _moveActiveLayer: (x: number, y: number) => void;
  /** Commit active layer position after a move drag ends */
  commitMoveLayer: () => void;

  // ── Crop actions ──────────────────────────────────────────────────────────
  /** Crop all layers to the given rect and push history */
  applyCrop: (x: number, y: number, width: number, height: number) => void;

  // ── View actions ──────────────────────────────────────────────────────────
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomFit: (containerW: number, containerH: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  setCursorPos: (pos: { x: number; y: number }) => void;

  // ── Tool actions ──────────────────────────────────────────────────────────
  setActiveTool: (tool: ActiveTool) => void;
  temporaryTool: (tool: ActiveTool) => void;
  restoreTool: () => void;

  // ── Selection actions ─────────────────────────────────────────────────────
  setSelectionMask: (mask: SelectionMask | null) => void;
  setSelectionMode: (mode: SelectionMode) => void;
  clearSelection: () => void;
  selectAll: () => void;

  // ── Colour actions ────────────────────────────────────────────────────────
  setForegroundColor: (color: RgbColor) => void;
  setBackgroundColor: (color: RgbColor) => void;
  swapColors: () => void;
  resetColors: () => void;

  // ── Tool option actions ───────────────────────────────────────────────────
  setBrushOptions: (opts: Partial<BrushOptions>) => void;
  setEraserOptions: (opts: Partial<EraserOptions>) => void;
  setFillOptions: (opts: Partial<FillOptions>) => void;

  // ── History actions ───────────────────────────────────────────────────────
  pushHistory: () => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;

  // ── Channel actions ───────────────────────────────────────────────────────
  setActiveChannel: (id: BuiltinChannelId | string) => void;
  setEditingChannel: (editing: boolean) => void;
  addCustomChannel: (name?: string) => void;
  deleteCustomChannel: (id: string) => void;
  setCustomChannelVisibility: (id: string, visible: boolean) => void;
  setCustomChannelOpacity: (id: string, opacity: number) => void;
  renameCustomChannel: (id: string, name: string) => void;
  /** Load the active channel's grayscale data as a selection mask */
  channelToSelection: (id: BuiltinChannelId | string) => void;
  /** Save current selection mask into a new custom channel */
  selectionToChannel: () => void;
}

// ── Zoom levels ──────────────────────────────────────────────────────────────

const ZOOM_LEVELS = [0.1, 0.25, 0.33, 0.5, 0.67, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 32];

function nextZoom(current: number, up: boolean): number {
  if (up) {
    const next = ZOOM_LEVELS.find(z => z > current + 1e-9);
    return next ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
  }
  const prev = [...ZOOM_LEVELS].reverse().find(z => z < current - 1e-9);
  return prev ?? ZOOM_LEVELS[0];
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useEditorStore = create<EditorState>((set, get) => ({
  document: null,
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  cursorPos: { x: 0, y: 0 },
  activeTool: 'none',
  prevTool: 'none',
  selectionMask: null,
  selectionMode: 'replace',
  foregroundColor: { r: 0, g: 0, b: 0 },
  backgroundColor: { r: 255, g: 255, b: 255 },
  brushOptions: { size: 20, hardness: 80, opacity: 100, flow: 100 },
  eraserOptions: { size: 20, hardness: 80, opacity: 100, flow: 100 },
  fillOptions: { tolerance: 32, mode: 'foreground' },
  _history: { past: [], future: [] },
  channelState: {
    activeChannelId: 'composite',
    editingChannel: false,
    customChannels: [],
  },

  activeLayer: () => {
    const doc = get().document;
    if (!doc || !doc.activeLayerId) return null;
    return doc.layers.find(l => l.id === doc.activeLayerId) ?? null;
  },

  canUndo: () => get()._history.past.length > 0,
  canRedo: () => get()._history.future.length > 0,

  // ── Document ──────────────────────────────────────────────────────────────

  newDocument: (width, height, name = 'Untitled') => {
    const layerCanvas = createLayerCanvas(width, height);
    const layer: Layer = {
      id: uuidv4(),
      name: 'Background',
      type: 'raster',
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: 'normal',
      canvas: layerCanvas,
      x: 0,
      y: 0,
    };
    const doc: CanvasDocument = {
      id: uuidv4(),
      name,
      width,
      height,
      layers: [layer],
      activeLayerId: layer.id,
    };
    set({ document: doc, selectionMask: null, _history: { past: [], future: [] }, zoom: 1, panOffset: { x: 0, y: 0 } });
  },

  openImage: (dataUrl, name = 'Untitled') => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const layerCanvas = createLayerCanvas(width, height);
      const ctx = layerCanvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const layer: Layer = {
        id: uuidv4(),
        name: 'Layer 1',
        type: 'raster',
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: 'normal',
        canvas: layerCanvas,
        x: 0,
        y: 0,
      };
      const doc: CanvasDocument = {
        id: uuidv4(),
        name,
        width,
        height,
        layers: [layer],
        activeLayerId: layer.id,
      };
      set({ document: doc, selectionMask: null, _history: { past: [], future: [] }, zoom: 1, panOffset: { x: 0, y: 0 } });
    };
    img.src = dataUrl;
  },

  closeDocument: () => set({ document: null, selectionMask: null, _history: { past: [], future: [] } }),

  // ── Layers ────────────────────────────────────────────────────────────────

  addLayer: (name, below) => {
    const doc = get().document;
    if (!doc) return;
    get().pushHistory();
    const canvas = createLayerCanvas(doc.width, doc.height);
    const layer: Layer = {
      id: uuidv4(),
      name: name ?? `Layer ${doc.layers.length + 1}`,
      type: 'raster',
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: 'normal',
      canvas,
      x: 0,
      y: 0,
    };
    const layers = [...doc.layers];
    const insertIdx = below
      ? layers.findIndex(l => l.id === below)
      : layers.length;
    layers.splice(insertIdx < 0 ? layers.length : insertIdx, 0, layer);
    set({ document: { ...doc, layers, activeLayerId: layer.id } });
  },

  deleteLayer: (id) => {
    const doc = get().document;
    if (!doc || doc.layers.length <= 1) return;
    get().pushHistory();
    const layers = doc.layers.filter(l => l.id !== id);
    const activeLayerId = doc.activeLayerId === id
      ? (layers[layers.length - 1]?.id ?? null)
      : doc.activeLayerId;
    set({ document: { ...doc, layers, activeLayerId } });
  },

  duplicateLayer: (id) => {
    const doc = get().document;
    if (!doc) return;
    get().pushHistory();
    const idx = doc.layers.findIndex(l => l.id === id);
    if (idx < 0) return;
    const src = doc.layers[idx];
    const newCanvas = createLayerCanvas(src.canvas.width, src.canvas.height);
    newCanvas.getContext('2d')!.drawImage(src.canvas, 0, 0);
    const copy: Layer = { ...src, id: uuidv4(), name: `${src.name} copy`, canvas: newCanvas };
    const layers = [...doc.layers];
    layers.splice(idx + 1, 0, copy);
    set({ document: { ...doc, layers, activeLayerId: copy.id } });
  },

  setActiveLayer: (id) => {
    const doc = get().document;
    if (!doc) return;
    set({ document: { ...doc, activeLayerId: id } });
  },

  setLayerVisibility: (id, visible) => {
    const doc = get().document;
    if (!doc) return;
    set({ document: { ...doc, layers: doc.layers.map(l => l.id === id ? { ...l, visible } : l) } });
  },

  setLayerLocked: (id, locked) => {
    const doc = get().document;
    if (!doc) return;
    set({ document: { ...doc, layers: doc.layers.map(l => l.id === id ? { ...l, locked } : l) } });
  },

  setLayerOpacity: (id, opacity) => {
    const doc = get().document;
    if (!doc) return;
    set({ document: { ...doc, layers: doc.layers.map(l => l.id === id ? { ...l, opacity } : l) } });
  },

  setLayerBlendMode: (id, mode) => {
    const doc = get().document;
    if (!doc) return;
    set({ document: { ...doc, layers: doc.layers.map(l => l.id === id ? { ...l, blendMode: mode } : l) } });
  },

  renameLayer: (id, name) => {
    const doc = get().document;
    if (!doc) return;
    set({ document: { ...doc, layers: doc.layers.map(l => l.id === id ? { ...l, name } : l) } });
  },

  reorderLayers: (fromIndex, toIndex) => {
    const doc = get().document;
    if (!doc) return;
    get().pushHistory();
    const layers = [...doc.layers];
    const [moved] = layers.splice(fromIndex, 1);
    layers.splice(toIndex, 0, moved);
    set({ document: { ...doc, layers } });
  },

  mergeDown: (id) => {
    const doc = get().document;
    if (!doc) return;
    get().pushHistory();
    set({ document: mergeDownUtil(doc, id) });
  },

  flattenAll: () => {
    const doc = get().document;
    if (!doc) return;
    get().pushHistory();
    set({ document: flattenAllUtil(doc) });
  },

  commitLayerPixels: (layerId, canvas, skipHistory = false) => {
    const doc = get().document;
    if (!doc) return;
    if (!skipHistory) get().pushHistory();
    const layers = doc.layers.map(l => {
      if (l.id !== layerId) return l;
      // Replace with the new canvas content
      const newCanvas = createLayerCanvas(canvas.width, canvas.height);
      newCanvas.getContext('2d')!.drawImage(canvas, 0, 0);
      return { ...l, canvas: newCanvas };
    });
    set({ document: { ...doc, layers } });
  },

  _moveActiveLayer: (x, y) => {
    const doc = get().document;
    if (!doc) return;
    const activeId = doc.activeLayerId;
    const layers = doc.layers.map(l => l.id === activeId ? { ...l, x, y } : l);
    set({ document: { ...doc, layers } });
  },

  commitMoveLayer: () => {
    // History was already pushed on mouse-down (in useMoveTool) before the drag began.
    // No further action needed here.
  },

  applyCrop: (x, y, width, height) => {
    const doc = get().document;
    if (!doc || width < 1 || height < 1) return;
    get().pushHistory();

    const cx = Math.round(x);
    const cy = Math.round(y);
    const cw = Math.round(width);
    const ch = Math.round(height);

    const croppedLayers = doc.layers.map(layer => {
      const newCanvas = createLayerCanvas(cw, ch);
      const ctx = newCanvas.getContext('2d')!;
      ctx.drawImage(layer.canvas, layer.x - cx, layer.y - cy);
      return { ...layer, canvas: newCanvas, x: 0, y: 0 };
    });

    set({
      document: { ...doc, layers: croppedLayers, width: cw, height: ch },
      selectionMask: null,
    });
  },

  // ── View ──────────────────────────────────────────────────────────────────

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(32, zoom)) }),
  zoomIn: () => set(s => ({ zoom: nextZoom(s.zoom, true) })),
  zoomOut: () => set(s => ({ zoom: nextZoom(s.zoom, false) })),
  zoomFit: (containerW, containerH) => {
    const doc = get().document;
    if (!doc) return;
    const zoom = Math.min(containerW / doc.width, containerH / doc.height) * 0.9;
    set({ zoom: Math.max(0.1, Math.min(32, zoom)), panOffset: { x: 0, y: 0 } });
  },
  setPanOffset: (offset) => set({ panOffset: offset }),
  setCursorPos: (pos) => set({ cursorPos: pos }),

  // ── Tool ──────────────────────────────────────────────────────────────────

  setActiveTool: (tool) => set({ activeTool: tool }),
  temporaryTool: (tool) => set(s => ({ prevTool: s.activeTool, activeTool: tool })),
  restoreTool: () => set(s => ({ activeTool: s.prevTool })),

  // ── Selection ─────────────────────────────────────────────────────────────

  setSelectionMask: (mask) => set({ selectionMask: mask }),
  setSelectionMode: (mode) => set({ selectionMode: mode }),
  clearSelection: () => set({ selectionMask: null }),
  selectAll: () => {
    const doc = get().document;
    if (!doc) return;
    const data = new Uint8ClampedArray(doc.width * doc.height).fill(255);
    set({ selectionMask: { data, width: doc.width, height: doc.height } });
  },

  // ── Colour ────────────────────────────────────────────────────────────────

  setForegroundColor: (color) => set({ foregroundColor: color }),
  setBackgroundColor: (color) => set({ backgroundColor: color }),
  swapColors: () => set(s => ({ foregroundColor: s.backgroundColor, backgroundColor: s.foregroundColor })),
  resetColors: () => set({ foregroundColor: { r: 0, g: 0, b: 0 }, backgroundColor: { r: 255, g: 255, b: 255 } }),

  // ── Tool options ──────────────────────────────────────────────────────────

  setBrushOptions: (opts) => set(s => ({ brushOptions: { ...s.brushOptions, ...opts } })),
  setEraserOptions: (opts) => set(s => ({ eraserOptions: { ...s.eraserOptions, ...opts } })),
  setFillOptions: (opts) => set(s => ({ fillOptions: { ...s.fillOptions, ...opts } })),

  // ── History ───────────────────────────────────────────────────────────────

  pushHistory: () => {
    const doc = get().document;
    if (!doc) return;
    const snap = snapshotDocument(doc);
    set(s => ({
      _history: {
        past: [...s._history.past.slice(-MAX_HISTORY + 1), snap],
        future: [],
      },
    }));
  },

  undo: async () => {
    const { _history, document: doc } = get();
    if (!doc || _history.past.length === 0) return;
    const currentSnap = snapshotDocument(doc);
    const past = [..._history.past];
    const snap = past.pop()!;
    const restored = await restoreDocument(snap);
    set(s => ({
      document: restored,
      _history: {
        past,
        future: [currentSnap, ...s._history.future.slice(0, MAX_HISTORY - 1)],
      },
    }));
  },

  redo: async () => {
    const { _history, document: doc } = get();
    if (!doc || _history.future.length === 0) return;
    const currentSnap = snapshotDocument(doc);
    const future = [..._history.future];
    const snap = future.shift()!;
    const restored = await restoreDocument(snap);
    set(s => ({
      document: restored,
      _history: {
        past: [...s._history.past.slice(-MAX_HISTORY + 1), currentSnap],
        future,
      },
    }));
  },

  // ── Channel actions ───────────────────────────────────────────────────────

  setActiveChannel: (id) => set(s => ({
    channelState: { ...s.channelState, activeChannelId: id },
  })),

  setEditingChannel: (editing) => set(s => ({
    channelState: { ...s.channelState, editingChannel: editing },
  })),

  addCustomChannel: (name) => {
    const doc = get().document;
    if (!doc) return;
    const canvas = createLayerCanvas(doc.width, doc.height);
    // Default: white (fully selected)
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, doc.width, doc.height);
    const ch: CustomChannel = {
      id: uuidv4(),
      name: name ?? `Alpha ${get().channelState.customChannels.length + 1}`,
      canvas,
      visible: true,
      opacity: 100,
      color: '#ff0000',
    };
    set(s => ({
      channelState: {
        ...s.channelState,
        customChannels: [...s.channelState.customChannels, ch],
        activeChannelId: ch.id,
      },
    }));
  },

  deleteCustomChannel: (id) => set(s => ({
    channelState: {
      ...s.channelState,
      customChannels: s.channelState.customChannels.filter(c => c.id !== id),
      activeChannelId: s.channelState.activeChannelId === id ? 'composite' : s.channelState.activeChannelId,
    },
  })),

  setCustomChannelVisibility: (id, visible) => set(s => ({
    channelState: {
      ...s.channelState,
      customChannels: s.channelState.customChannels.map(c => c.id === id ? { ...c, visible } : c),
    },
  })),

  setCustomChannelOpacity: (id, opacity) => set(s => ({
    channelState: {
      ...s.channelState,
      customChannels: s.channelState.customChannels.map(c => c.id === id ? { ...c, opacity } : c),
    },
  })),

  renameCustomChannel: (id, name) => set(s => ({
    channelState: {
      ...s.channelState,
      customChannels: s.channelState.customChannels.map(c => c.id === id ? { ...c, name } : c),
    },
  })),

  channelToSelection: (id) => {
    const doc = get().document;
    if (!doc) return;
    const { width, height } = doc;

    const builtinIds: BuiltinChannelId[] = ['composite', 'red', 'green', 'blue', 'alpha'];
    if (builtinIds.includes(id as BuiltinChannelId)) {
      // Extract channel from the flattened composite
      const flat = flattenLayers(doc.layers, width, height);
      const ctx = flat.getContext('2d', { willReadFrequently: true })!;
      const imgData = ctx.getImageData(0, 0, width, height);
      const mask = new Uint8ClampedArray(width * height);
      for (let i = 0; i < width * height; i++) {
        const base = i * 4;
        if (id === 'red')   mask[i] = imgData.data[base];
        else if (id === 'green') mask[i] = imgData.data[base + 1];
        else if (id === 'blue')  mask[i] = imgData.data[base + 2];
        else if (id === 'alpha') mask[i] = imgData.data[base + 3];
        else mask[i] = Math.round((imgData.data[base] * 0.299 + imgData.data[base + 1] * 0.587 + imgData.data[base + 2] * 0.114));
      }
      set({ selectionMask: { data: mask, width, height } });
    } else {
      // Custom channel
      const ch = get().channelState.customChannels.find(c => c.id === id);
      if (!ch) return;
      const ctx = ch.canvas.getContext('2d', { willReadFrequently: true })!;
      const imgData = ctx.getImageData(0, 0, width, height);
      const mask = new Uint8ClampedArray(width * height);
      for (let i = 0; i < width * height; i++) {
        mask[i] = imgData.data[i * 4]; // red channel of grayscale
      }
      set({ selectionMask: { data: mask, width, height } });
    }
  },

  selectionToChannel: () => {
    const doc = get().document;
    const mask = get().selectionMask;
    if (!doc || !mask) return;
    const canvas = createLayerCanvas(doc.width, doc.height);
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(doc.width, doc.height);
    for (let i = 0; i < mask.data.length; i++) {
      const v = mask.data[i];
      imgData.data[i * 4 + 0] = v;
      imgData.data[i * 4 + 1] = v;
      imgData.data[i * 4 + 2] = v;
      imgData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    const ch: CustomChannel = {
      id: uuidv4(),
      name: `Selection ${get().channelState.customChannels.length + 1}`,
      canvas,
      visible: true,
      opacity: 100,
      color: '#ff0000',
    };
    set(s => ({
      channelState: {
        ...s.channelState,
        customChannels: [...s.channelState.customChannels, ch],
        activeChannelId: ch.id,
      },
    }));
  },
}));

// ── Composite canvas (shared singleton, updated when layers change) ───────────

let _compositeCanvas: HTMLCanvasElement | null = null;

/** Returns the up-to-date composite canvas for the current document state. */
export function getCompositeCanvas(): HTMLCanvasElement | null {
  const { document: doc } = useEditorStore.getState();
  if (!doc) return null;
  if (!_compositeCanvas) _compositeCanvas = document.createElement('canvas');
  return flattenLayers(doc.layers, doc.width, doc.height, _compositeCanvas);
}
