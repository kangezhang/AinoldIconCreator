export interface ElectronAPI {
  cropImage: (imagePath: string, cropData: CropData) => Promise<string>;
  generateIcons: (imageBase64: string, outputPath: string) => Promise<GenerateResult>;
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

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
