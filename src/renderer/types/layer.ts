export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export interface Layer {
  id: string;
  name: string;
  type: 'raster';
  visible: boolean;
  locked: boolean;
  /** 0–100 */
  opacity: number;
  blendMode: BlendMode;
  /** Off-screen canvas holding this layer's pixel data */
  canvas: HTMLCanvasElement;
  /** Position offset relative to document origin */
  x: number;
  y: number;
}

export interface CanvasDocument {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Ordered bottom-to-top */
  layers: Layer[];
  activeLayerId: string | null;
}

/** Snapshot of document state stored in undo history.
 *  Canvas pixel data is serialised as PNG data-URL strings to allow
 *  deep copies without sharing references.
 */
export interface LayerSnapshot {
  id: string;
  name: string;
  type: 'raster';
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  dataUrl: string;
  x: number;
  y: number;
}

export interface DocumentSnapshot {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: LayerSnapshot[];
  activeLayerId: string | null;
}

// ── Channels ──────────────────────────────────────────────────────────────────

/** Built-in composite + component channels */
export type BuiltinChannelId = 'composite' | 'red' | 'green' | 'blue' | 'alpha';

/** A user-created spot/alpha channel stored as a grayscale canvas */
export interface CustomChannel {
  id: string;
  name: string;
  /** Grayscale canvas — white = fully selected/opaque, black = transparent */
  canvas: HTMLCanvasElement;
  visible: boolean;
  /** 0–100 */
  opacity: number;
  /** Overlay color for display (hex) */
  color: string;
}

/** Which channel(s) are currently active for editing */
export interface ChannelState {
  /** Currently visible/active channel for editing */
  activeChannelId: BuiltinChannelId | string;
  /** Whether we are in channel-edit mode (painting affects only the active channel) */
  editingChannel: boolean;
  /** User-created alpha/spot channels */
  customChannels: CustomChannel[];
}
