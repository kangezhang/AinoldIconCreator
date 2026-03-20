import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';
import * as png2icons from 'png2icons';
import { removeColorFromBase64, removeColorAtPoint } from './colorRemoval';
import { applySelectionToImage } from './applySelection';
import { logError, logInfo } from './logger';

let mainWindow: any = null;

function getAppIconPath() {
  const appPath = app.getAppPath();
  return path.join(appPath, 'assets', 'icon.ico');
}

function resolvePreloadPath() {
  const candidates = [
    path.join(__dirname, '../preload/preload.js'),
    path.join(app.getAppPath(), 'dist/preload/preload.js')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  console.warn('Preload script not found. Tried:', candidates);
  return candidates[0];
}

function createWindow() {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.ainold.iconcreator');
  }

  mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    minWidth: 700,
    minHeight: 600,
    icon: process.platform === 'win32' ? getAppIconPath() : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: resolvePreloadPath()
    },
    autoHideMenuBar: true,
    backgroundColor: '#ffffff'
  });

  // 隐藏菜单栏
  mainWindow.setMenuBarVisibility(false);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// 处理图片裁剪
ipcMain.handle('crop-image', async (event: any, { imagePath, cropData }: any) => {
  try {
    const { x, y, width, height } = cropData;

    const croppedBuffer = await sharp(imagePath)
      .extract({
        left: Math.round(x),
        top: Math.round(y),
        width: Math.round(width),
        height: Math.round(height)
      })
      .toBuffer();

    return croppedBuffer.toString('base64');
  } catch (error) {
    console.error('Crop error:', error);
    throw error;
  }
});

// 生成图标
ipcMain.handle('generate-icons', async (event: any, { imageBase64, outputPath }: any) => {
  try {
    logInfo('Generate icons requested');
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // 确保图片是正方形且至少1024x1024
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    const size = Math.max(metadata.width || 1024, metadata.height || 1024, 1024);

    // 调整大小并居中，确保输出完整的 PNG 格式
    const resizedBuffer = await sharp(imageBuffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        force: true
      })
      .toBuffer();

    // 选择保存位置
    const result = await dialog.showSaveDialog({
      title: '保存图标',
      defaultPath: outputPath || 'icon',
      filters: [
        { name: 'Windows Icon', extensions: ['ico'] },
        { name: 'Mac Icon', extensions: ['icns'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, message: '用户取消' };
    }

    const savePath = result.filePath;
    const ext = path.extname(savePath).toLowerCase();

    if (ext === '.ico') {
      // 生成 ICO
      const icoBuffer = png2icons.createICO(resizedBuffer, png2icons.BICUBIC, 0, false);
      if (icoBuffer) {
        fs.writeFileSync(savePath, icoBuffer);
      }
    } else if (ext === '.icns') {
      // 生成 ICNS
      const icnsBuffer = png2icons.createICNS(resizedBuffer, png2icons.BICUBIC, 0);
      if (icnsBuffer) {
        fs.writeFileSync(savePath, icnsBuffer);
      }
    } else {
      // 默认生成两个文件
      const basePath = savePath.replace(/\.[^/.]+$/, '');
      const icoBuffer = png2icons.createICO(resizedBuffer, png2icons.BICUBIC, 0, false);
      const icnsBuffer = png2icons.createICNS(resizedBuffer, png2icons.BICUBIC, 0);

      if (icoBuffer) {
        fs.writeFileSync(basePath + '.ico', icoBuffer);
      }
      if (icnsBuffer) {
        fs.writeFileSync(basePath + '.icns', icnsBuffer);
      }
    }

    return { success: true, path: savePath };
  } catch (error) {
    console.error('Generate icons error:', error);
    logError('Generate icons failed', error);
    const err = error as NodeJS.ErrnoException;
    let message = err?.message || 'Unknown error';
    if (err?.code === 'UNKNOWN' && err?.path) {
      message += ' (Try saving to a different folder or allow the app in Windows Controlled Folder Access.)';
    }
    return { success: false, message };
  }
});

ipcMain.handle('remove-color', async (event: any, { imageBase64, color, tolerance }: any) => {
  try {
    logInfo('Remove color requested', { color, tolerance, inputSize: imageBase64?.length || 0 });
    const resultBase64 = await removeColorFromBase64(imageBase64, color, tolerance);
    return { success: true, imageBase64: resultBase64 };
  } catch (error) {
    console.error('Remove color error:', error);
    logError('Remove color failed', error);
    return { success: false, message: (error as Error).message };
  }
});

ipcMain.handle('remove-color-at-point', async (event: any, { imageBase64, seedX, seedY, tolerance }: any) => {
  try {
    logInfo('Remove color at point requested', { seedX, seedY, tolerance, inputSize: imageBase64?.length || 0 });
    const resultBase64 = await removeColorAtPoint(imageBase64, seedX, seedY, tolerance);
    return { success: true, imageBase64: resultBase64 };
  } catch (error) {
    console.error('Remove color at point error:', error);
    logError('Remove color at point failed', error);
    return { success: false, message: (error as Error).message };
  }
});

ipcMain.handle('apply-selection', async (event: any, { imageBase64, maskData, maskWidth, maskHeight }: any) => {
  try {
    logInfo('Apply selection requested', { maskWidth, maskHeight, pixels: maskData?.length || 0 });
    const resultBase64 = await applySelectionToImage(imageBase64, maskData, maskWidth, maskHeight);
    return { success: true, imageBase64: resultBase64 };
  } catch (error) {
    logError('Apply selection failed', error);
    return { success: false, message: (error as Error).message };
  }
});
