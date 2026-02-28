import { contextBridge, ipcRenderer } from 'electron';

const api = {
  cropImage: (imagePath: string, cropData: any) =>
    ipcRenderer.invoke('crop-image', { imagePath, cropData }),

  generateIcons: (imageBase64: string, outputPath: string) =>
    ipcRenderer.invoke('generate-icons', { imageBase64, outputPath }),

  removeColor: (imageBase64: string, color: { r: number; g: number; b: number }, tolerance: number) =>
    ipcRenderer.invoke('remove-color', { imageBase64, color, tolerance }),

  removeColorAtPoint: (imageBase64: string, seedX: number, seedY: number, tolerance: number) =>
    ipcRenderer.invoke('remove-color-at-point', { imageBase64, seedX, seedY, tolerance }),

  applySelection: (imageBase64: string, maskData: number[], maskWidth: number, maskHeight: number) =>
    ipcRenderer.invoke('apply-selection', { imageBase64, maskData, maskWidth, maskHeight }),
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electronAPI', api);
} else {
  (globalThis as typeof globalThis & { electronAPI?: typeof api }).electronAPI = api;
}
