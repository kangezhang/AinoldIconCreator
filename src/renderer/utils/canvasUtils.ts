import type React from 'react';
import type { RgbColor } from '../types';

export function getCanvasPoint(
  e: React.MouseEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
  zoom = 1
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) / zoom,
    y: (e.clientY - rect.top) / zoom,
  };
}

export function canvasToImageCoords(
  canvasX: number,
  canvasY: number,
  imageSize: { width: number; height: number },
  img: HTMLImageElement
): { x: number; y: number } | null {
  if (!img || imageSize.width === 0 || imageSize.height === 0) return null;
  const scaleX = img.width / imageSize.width;
  const scaleY = img.height / imageSize.height;
  return {
    x: Math.min(img.width - 1, Math.max(0, Math.round(canvasX * scaleX))),
    y: Math.min(img.height - 1, Math.max(0, Math.round(canvasY * scaleY))),
  };
}

export function pickColorAtCanvas(
  canvasX: number,
  canvasY: number,
  imageSize: { width: number; height: number },
  img: HTMLImageElement,
  sampleCanvas: HTMLCanvasElement
): RgbColor | null {
  const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  if (!sampleCtx || imageSize.width === 0 || imageSize.height === 0) return null;
  const scaleX = img.width / imageSize.width;
  const scaleY = img.height / imageSize.height;
  const srcX = Math.min(img.width - 1, Math.max(0, Math.round(canvasX * scaleX)));
  const srcY = Math.min(img.height - 1, Math.max(0, Math.round(canvasY * scaleY)));
  const data = sampleCtx.getImageData(srcX, srcY, 1, 1).data;
  return { r: data[0], g: data[1], b: data[2] };
}
