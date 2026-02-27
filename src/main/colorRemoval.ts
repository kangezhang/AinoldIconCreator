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

/**
 * 从图像四条边出发，用 BFS 洪水填充找出所有与目标颜色相似的外部连通像素。
 * 只有这些像素会被变透明，内部同色区域不受影响。
 */
function floodFillFromEdges(
  data: Buffer,
  width: number,
  height: number,
  color: RgbColor,
  threshold: number
): Uint8Array {
  // 记录每个像素是否属于"外部背景"
  const isBg = new Uint8Array(width * height); // 0=未访问, 1=背景, 2=已访问非背景

  function colorDist(idx: number): number {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return Math.max(Math.abs(r - color.r), Math.abs(g - color.g), Math.abs(b - color.b));
  }

  function pixelIdx(x: number, y: number) { return y * width + x; }

  // BFS 队列，使用整数索引避免对象分配
  const queue: number[] = [];

  // 将四条边上颜色匹配的像素加入队列
  function tryEnqueue(x: number, y: number) {
    const pi = pixelIdx(x, y);
    if (isBg[pi] !== 0) return;
    const dist = colorDist(pi * 3);
    if (dist <= threshold) {
      isBg[pi] = 1;
      queue.push(pi);
    } else {
      isBg[pi] = 2; // 标记为已访问但不是背景
    }
  }

  for (let x = 0; x < width; x++) {
    tryEnqueue(x, 0);
    tryEnqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    tryEnqueue(0, y);
    tryEnqueue(width - 1, y);
  }

  // BFS 扩展
  const dx = [1, -1, 0, 0];
  const dy = [0, 0, 1, -1];

  let head = 0;
  while (head < queue.length) {
    const pi = queue[head++];
    const x = pi % width;
    const y = Math.floor(pi / width);

    for (let d = 0; d < 4; d++) {
      const nx = x + dx[d];
      const ny = y + dy[d];
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const npi = pixelIdx(nx, ny);
      if (isBg[npi] !== 0) continue;
      const dist = colorDist(npi * 3);
      if (dist <= threshold) {
        isBg[npi] = 1;
        queue.push(npi);
      } else {
        isBg[npi] = 2;
      }
    }
  }

  return isBg;
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
  const softness = Math.max(1, threshold * 0.3);

  // 用洪水填充找出外部连通背景区域
  const isBg = floodFillFromEdges(data, width, height, color, threshold);

  // 创建 RGBA buffer
  const rgbaBuffer = Buffer.alloc(pixelCount * 4);
  const alphaStats = Buffer.alloc(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const rgbIdx = i * 3;
    const rgbaIdx = i * 4;

    const r = data[rgbIdx];
    const g = data[rgbIdx + 1];
    const b = data[rgbIdx + 2];

    let alphaValue: number;
    if (isBg[i] === 1) {
      // 外部背景像素：根据颜色距离做软边缘
      const dr = r - color.r;
      const dg = g - color.g;
      const db = b - color.b;
      const dist = Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db));
      const alpha = clamp((dist - threshold) / softness, 0, 1);
      alphaValue = Math.round(alpha * 255);
    } else {
      // 内部像素：完全保留
      alphaValue = 255;
    }

    rgbaBuffer[rgbaIdx] = r;
    rgbaBuffer[rgbaIdx + 1] = g;
    rgbaBuffer[rgbaIdx + 2] = b;
    rgbaBuffer[rgbaIdx + 3] = alphaValue;

    alphaStats[i] = alphaValue;
  }

  logInfo('Remove color alpha stats', computeAlphaStats(alphaStats));

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
