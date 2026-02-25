export interface ElectronAPI {
  cropImage: (imagePath: string, cropData: CropData) => Promise<string>;
  generateIcons: (imageBase64: string, outputPath: string) => Promise<GenerateResult>;
  removeColor: (imageBase64: string, color: RgbColor, tolerance: number) => Promise<RemoveColorResult>;
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

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
