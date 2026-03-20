// Re-export all types for convenient single-import access
export type { ActiveTool, BrushOptions, EraserOptions, FillOptions, CropOptions } from './tool';
export type { SelectionMode, SelectionMask, MaybeSelectionMask, SelectionToolParams, ToolMouseHandlers, CanvasRect } from './selection';
export type { BlendMode, Layer, CanvasDocument, LayerSnapshot, DocumentSnapshot, BuiltinChannelId, CustomChannel, ChannelState } from './layer';

// ── Electron IPC types ───────────────────────────────────────────────────────

export interface ElectronAPI {
  cropImage: (imagePath: string, cropData: CropData) => Promise<string>;
  generateIcons: (imageBase64: string, outputPath: string) => Promise<GenerateResult>;
  removeColor: (imageBase64: string, color: RgbColor, tolerance: number) => Promise<RemoveColorResult>;
  removeColorAtPoint: (imageBase64: string, seedX: number, seedY: number, tolerance: number) => Promise<RemoveColorResult>;
  applySelection: (imageBase64: string, maskData: number[], maskWidth: number, maskHeight: number) => Promise<RemoveColorResult>;
}

export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GenerateResult {
  success: boolean;
  path?: string;
  message?: string;
}

export interface RemoveColorResult {
  success: boolean;
  imageBase64?: string;
  message?: string;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface HsvColor {
  h: number; // 0-360
  s: number; // 0-100
  v: number; // 0-100
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
