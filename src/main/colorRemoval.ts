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

  // 相邻像素之间的颜色差（防止通过渐变色链泄漏到内部）
  function neighborDist(idxA: number, idxB: number): number {
    return Math.max(
      Math.abs(data[idxA] - data[idxB]),
      Math.abs(data[idxA + 1] - data[idxB + 1]),
      Math.abs(data[idxA + 2] - data[idxB + 2])
    );
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
  // 相邻像素间的最大允许颜色差：限制为 threshold 的一半，防止渐变泄漏
  const neighborThreshold = threshold * 0.5;

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
      const distToColor = colorDist(npi * 3);
      const distToNeighbor = neighborDist(pi * 3, npi * 3);
      // 两个条件都需要满足：与目标色相似 AND 与当前像素颜色接近
      if (distToColor <= threshold && distToNeighbor <= neighborThreshold) {
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

/**
 * 从指定点出发，BFS 洪水填充找出连通的相似色区域，将其变透明。
 * 保留图像原有的透明通道（叠加处理）。
 */
function floodFillFromPoint(
  data: Buffer,         // RGBA buffer
  width: number,
  height: number,
  seedX: number,
  seedY: number,
  threshold: number
): Uint8Array {
  const isFill = new Uint8Array(width * height); // 1 = 需要变透明

  const seedIdx = (seedY * width + seedX) * 4;
  const seedR = data[seedIdx];
  const seedG = data[seedIdx + 1];
  const seedB = data[seedIdx + 2];
  const seedA = data[seedIdx + 3];

  // 如果种子点本身已经是透明的，无需处理
  if (seedA < 10) return isFill;

  function colorDist(rgbaIdx: number): number {
    return Math.max(
      Math.abs(data[rgbaIdx] - seedR),
      Math.abs(data[rgbaIdx + 1] - seedG),
      Math.abs(data[rgbaIdx + 2] - seedB)
    );
  }

  function neighborDist(idxA: number, idxB: number): number {
    return Math.max(
      Math.abs(data[idxA] - data[idxB]),
      Math.abs(data[idxA + 1] - data[idxB + 1]),
      Math.abs(data[idxA + 2] - data[idxB + 2])
    );
  }

  const neighborThreshold = threshold * 0.5;
  const queue: number[] = [];

  const seedPi = seedY * width + seedX;
  isFill[seedPi] = 1;
  queue.push(seedPi);

  const dx = [1, -1, 0, 0];
  const dy = [0, 0, 1, -1];

  let head = 0;
  while (head < queue.length) {
    const pi = queue[head++];
    const x = pi % width;
    const y = Math.floor(pi / width);
    const rgbaIdx = pi * 4;

    for (let d = 0; d < 4; d++) {
      const nx = x + dx[d];
      const ny = y + dy[d];
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const npi = ny * width + nx;
      if (isFill[npi] !== 0) continue;
      const nRgbaIdx = npi * 4;
      // 跳过已透明像素
      if (data[nRgbaIdx + 3] < 10) {
        isFill[npi] = 2;
        continue;
      }
      const distToSeed = colorDist(nRgbaIdx);
      const distToNeighbor = neighborDist(rgbaIdx, nRgbaIdx);
      if (distToSeed <= threshold && distToNeighbor <= neighborThreshold) {
        isFill[npi] = 1;
        queue.push(npi);
      } else {
        isFill[npi] = 2;
      }
    }
  }

  return isFill;
}

/**
 * 在已有图像（含透明通道）上，从指定像素坐标出发做 flood fill，将连通区域变透明。
 * seedX/seedY 是相对于原始图像分辨率的坐标。
 */
export async function removeColorAtPoint(
  imageBase64: string,
  seedX: number,
  seedY: number,
  tolerance: number
) {
  const imageBuffer = Buffer.from(imageBase64, 'base64');
  // 保留 alpha 通道（ensureAlpha 确保有 4 通道）
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;

  const clampedX = Math.max(0, Math.min(width - 1, Math.round(seedX)));
  const clampedY = Math.max(0, Math.min(height - 1, Math.round(seedY)));

  const threshold = clamp(tolerance, 0, 100) / 100 * 255;
  const softness = Math.max(1, threshold * 0.3);

  // 读取种子颜色（用于软边缘计算）
  const seedRgbaIdx = (clampedY * width + clampedX) * 4;
  const seedColor = {
    r: data[seedRgbaIdx],
    g: data[seedRgbaIdx + 1],
    b: data[seedRgbaIdx + 2],
  };

  const isFill = floodFillFromPoint(data, width, height, clampedX, clampedY, threshold);

  // 修改 alpha 通道
  for (let i = 0; i < width * height; i++) {
    if (isFill[i] !== 1) continue;
    const rgbaIdx = i * 4;
    const r = data[rgbaIdx];
    const g = data[rgbaIdx + 1];
    const b = data[rgbaIdx + 2];
    const dist = Math.max(Math.abs(r - seedColor.r), Math.abs(g - seedColor.g), Math.abs(b - seedColor.b));
    const alpha = clamp((dist - threshold) / softness, 0, 1);
    data[rgbaIdx + 3] = Math.round(alpha * 255);
  }

  const pngBuffer = await sharp(Buffer.from(data), {
    raw: { width, height, channels: 4 }
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
