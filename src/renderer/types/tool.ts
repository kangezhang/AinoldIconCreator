import type { RgbColor } from './index';

export type ActiveTool =
  // View / navigation
  | 'hand'
  | 'zoom'
  | 'move'
  // Selection
  | 'rectSelect'
  | 'ellipseSelect'
  | 'lassoSelect'
  | 'paintSelect'
  // Painting
  | 'brush'
  | 'eraser'
  | 'fill'
  // Image tools
  | 'crop'
  | 'colorPick'
  | 'pointErase'
  | 'none';

export interface BrushOptions {
  /** Diameter in canvas pixels (1–500) */
  size: number;
  /** Edge hardness 0 (feathered) – 100 (hard) */
  hardness: number;
  /** Layer opacity multiplier 0–100 */
  opacity: number;
  /** Paint flow 0–100 */
  flow: number;
}

export interface EraserOptions {
  size: number;
  hardness: number;
  opacity: number;
  flow: number;
}

export interface FillOptions {
  /** Flood-fill colour tolerance 0–255 */
  tolerance: number;
  /** Fill with foreground colour or make transparent */
  mode: 'foreground' | 'transparent';
}

export interface CropOptions {
  /** aspect ratio as [w, h], null = free */
  aspectRatio: [number, number] | null;
}
