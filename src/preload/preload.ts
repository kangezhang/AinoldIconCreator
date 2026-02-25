import { contextBridge, ipcRenderer } from 'electron';

const api = {
  cropImage: (imagePath: string, cropData: any) =>
    ipcRenderer.invoke('crop-image', { imagePath, cropData }),

  generateIcons: (imageBase64: string, outputPath: string) =>
    ipcRenderer.invoke('generate-icons', { imageBase64, outputPath })
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electronAPI', api);
} else {
  (globalThis as typeof globalThis & { electronAPI?: typeof api }).electronAPI = api;
}
