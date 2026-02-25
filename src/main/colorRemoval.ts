import sharp from 'sharp';
import { logInfo } from './logger';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export async function removeColorFromBase64(
  imageBase64: string,
  color: RgbColor,
  tolerance: number
) {
  const imageBuffer = Buffer.from(imageBase64, 'base64');
  const { data, info } = await sharp(imageBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const pixelCount = width * height;

  const threshold = clamp(tolerance, 0, 100) / 100 * 255;
  const softness = Math.max(1, threshold * 0.5);

  // 创建 RGBA buffer（直接包含 RGB + Alpha）
  const rgbaBuffer = Buffer.alloc(pixelCount * 4);
  const alphaStats = Buffer.alloc(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const rgbIdx = i * 3;
    const rgbaIdx = i * 4;

    const r = data[rgbIdx];
    const g = data[rgbIdx + 1];
    const b = data[rgbIdx + 2];

    const dr = r - color.r;
    const dg = g - color.g;
    const db = b - color.b;
    const dist = Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db));
    const alpha = clamp((dist - threshold) / softness, 0, 1);
    const alphaValue = Math.round(alpha * 255);

    // 写入 RGBA
    rgbaBuffer[rgbaIdx] = r;
    rgbaBuffer[rgbaIdx + 1] = g;
    rgbaBuffer[rgbaIdx + 2] = b;
    rgbaBuffer[rgbaIdx + 3] = alphaValue;

    alphaStats[i] = alphaValue;
  }

  logInfo('Remove color alpha stats', computeAlphaStats(alphaStats));

  // 使用 raw RGBA 数据创建 PNG
  const pngBuffer = await sharp(rgbaBuffer, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .png()
    .toBuffer();

  return pngBuffer.toString('base64');
}

function computeAlphaStats(alphaBuffer: Buffer) {
  let min = 255;
  let max = 0;
  let sum = 0;
  let transparent = 0;
  let opaque = 0;
  const total = alphaBuffer.length;

  for (let i = 0; i < total; i++) {
    const value = alphaBuffer[i];
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
    if (value <= 10) transparent += 1;
    if (value >= 245) opaque += 1;
  }

  return {
    min,
    max,
    mean: total ? sum / total : 0,
    transparentPct: total ? (transparent / total) * 100 : 0,
    opaquePct: total ? (opaque / total) * 100 : 0
  };
}
