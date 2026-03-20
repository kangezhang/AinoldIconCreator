import type React from 'react';

export type { ActiveTool } from './tool';

export type SelectionMode = 'replace' | 'add' | 'subtract';

export interface SelectionMask {
  /** 0 = not selected, 255 = fully selected. Canvas-display coordinates. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export type MaybeSelectionMask = SelectionMask | null;

export interface SelectionToolParams {
  isActive: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  imageSize: { width: number; height: number };
  selectionMode: SelectionMode;
  onCommit: (mask: SelectionMask) => void;
  /** Zoom level applied via CSS transform (default: 1) */
  zoom?: number;
}

export interface ToolMouseHandlers {
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
}

export interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
