import React, { useState, useRef, useEffect } from 'react';

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedImage: string) => void;
  isPickingColor?: boolean;
  onColorPick?: (color: { r: number; g: number; b: number }) => void;
}

type DragMode = 'move' | 'resize' | null;

const ImageCropper: React.FC<ImageCropperProps> = ({
  image,
  onCropComplete,
  isPickingColor = false,
  onColorPick
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const imgRef = useRef<HTMLImageElement>(new Image());

  useEffect(() => {
    const img = imgRef.current;
    img.crossOrigin = 'anonymous'; // 允许读取图片数据
    img.src = image;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
      if (!ctx) return;

      // 计算适应容器的尺寸
      const maxWidth = 500;
      const maxHeight = 500;
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = width * ratio;
        height = height * ratio;
      }

      canvas.width = width;
      canvas.height = height;
      setImageSize({ width, height });

      // 调试：测试图片本身是否有透明通道
      const testCanvas = document.createElement('canvas');
      testCanvas.width = img.width;
      testCanvas.height = img.height;
      const testCtx = testCanvas.getContext('2d', { alpha: true });
      if (testCtx) {
        testCtx.drawImage(img, 0, 0);
        const testData = testCtx.getImageData(0, 0, img.width, img.height);
        let transparentCount = 0;
        for (let i = 3; i < testData.data.length; i += 4) {
          if (testData.data[i] < 255) transparentCount++;
        }
        console.log(`[Image Load] Transparent pixels in original image: ${transparentCount} / ${img.width * img.height} (${(transparentCount / (img.width * img.height) * 100).toFixed(2)}%)`);
      }

      // 初始化裁剪区域为正方形
      const size = Math.min(width, height);
      const x = (width - size) / 2;
      const y = (height - size) / 2;
      const initialCrop = { x, y, width: size, height: size };
      setCrop(initialCrop);

      if (!sampleCanvasRef.current) {
        sampleCanvasRef.current = document.createElement('canvas');
      }
      const sampleCanvas = sampleCanvasRef.current;
      sampleCanvas.width = img.width;
      sampleCanvas.height = img.height;
      const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
      if (sampleCtx) {
        sampleCtx.clearRect(0, 0, img.width, img.height);
        sampleCtx.drawImage(img, 0, 0, img.width, img.height);
      }

      drawCanvas(ctx, img, initialCrop, width, height);
      performCrop(initialCrop, { width, height });
    };
  }, [image]);

  const drawCanvas = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    cropArea: { x: number; y: number; width: number; height: number },
    canvasWidth: number,
    canvasHeight: number
  ) => {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 先绘制整张图片（包含透明通道）
    ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

    // 调试：检查图片是否有透明像素
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    let transparentCount = 0;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] < 255) transparentCount++;
    }
    console.log(`Transparent pixels: ${transparentCount} / ${canvasWidth * canvasHeight} (${(transparentCount / (canvasWidth * canvasHeight) * 100).toFixed(2)}%)`);

    // 在裁剪区域外绘制半透明黑色遮罩
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.clearRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    ctx.restore();

    // 在裁剪区域内绘制棋盘格背景（显示透明度）
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    const tile = 16;
    for (let y = Math.floor(cropArea.y / tile) * tile; y < cropArea.y + cropArea.height; y += tile) {
      for (let x = Math.floor(cropArea.x / tile) * tile; x < cropArea.x + cropArea.width; x += tile) {
        const isDark = (Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0;
        ctx.fillStyle = isDark ? '#f1f5f9' : '#e2e8f0';
        ctx.fillRect(
          Math.max(cropArea.x, x),
          Math.max(cropArea.y, y),
          Math.min(tile, cropArea.x + cropArea.width - x),
          Math.min(tile, cropArea.y + cropArea.height - y)
        );
      }
    }
    ctx.restore();

    // 重新绘制裁剪区域的图片（在棋盘格上方）
    ctx.drawImage(
      img,
      (cropArea.x / canvasWidth) * img.width,
      (cropArea.y / canvasHeight) * img.height,
      (cropArea.width / canvasWidth) * img.width,
      (cropArea.height / canvasHeight) * img.height,
      cropArea.x,
      cropArea.y,
      cropArea.width,
      cropArea.height
    );

    // 绘制裁剪框
    ctx.strokeStyle = '#4F46E5';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
  };

  const isInsideCrop = (x: number, y: number) => {
    return (
      x >= crop.x &&
      x <= crop.x + crop.width &&
      y >= crop.y &&
      y <= crop.y + crop.height
    );
  };

  const isNearEdge = (x: number, y: number) => {
    const threshold = 15;
    const right = crop.x + crop.width;
    const bottom = crop.y + crop.height;

    return (
      (Math.abs(x - right) < threshold && Math.abs(y - bottom) < threshold) ||
      (Math.abs(x - right) < threshold && y >= crop.y && y <= bottom) ||
      (Math.abs(y - bottom) < threshold && x >= crop.x && x <= right)
    );
  };

  const pickColorAt = (canvasX: number, canvasY: number) => {
    const img = imgRef.current;
    const sampleCanvas = sampleCanvasRef.current;
    if (!img || !sampleCanvas) return null;
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!sampleCtx || imageSize.width === 0 || imageSize.height === 0) return null;

    const scaleX = img.width / imageSize.width;
    const scaleY = img.height / imageSize.height;
    const srcX = Math.min(img.width - 1, Math.max(0, Math.round(canvasX * scaleX)));
    const srcY = Math.min(img.height - 1, Math.max(0, Math.round(canvasY * scaleY)));
    const data = sampleCtx.getImageData(srcX, srcY, 1, 1).data;
    return { r: data[0], g: data[1], b: data[2] };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isPickingColor && onColorPick) {
      const color = pickColorAt(x, y);
      if (color) {
        onColorPick(color);
      }
      return;
    }

    if (isNearEdge(x, y)) {
      setDragMode('resize');
    } else if (isInsideCrop(x, y)) {
      setDragMode('move');
    } else {
      return;
    }

    setDragStart({ x, y });
    setCropStart({ ...crop });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 更新鼠标样式
    if (isPickingColor) {
      canvas.style.cursor = 'crosshair';
      return;
    }

    if (!dragMode) {
      if (isNearEdge(x, y)) {
        canvas.style.cursor = 'nwse-resize';
      } else if (isInsideCrop(x, y)) {
        canvas.style.cursor = 'move';
      } else {
        canvas.style.cursor = 'default';
      }
      return;
    }

    const deltaX = x - dragStart.x;
    const deltaY = y - dragStart.y;

    let newCrop = { ...crop };

    if (dragMode === 'move') {
      // 移动裁剪框
      newCrop.x = cropStart.x + deltaX;
      newCrop.y = cropStart.y + deltaY;

      // 边界检查
      newCrop.x = Math.max(0, Math.min(imageSize.width - crop.width, newCrop.x));
      newCrop.y = Math.max(0, Math.min(imageSize.height - crop.height, newCrop.y));
    } else if (dragMode === 'resize') {
      // 调整大小（保持正方形）
      const delta = Math.max(deltaX, deltaY);
      let newSize = cropStart.width + delta;

      // 限制最小和最大尺寸
      const minSize = 50;
      const maxSize = Math.min(imageSize.width, imageSize.height);
      newSize = Math.max(minSize, Math.min(maxSize, newSize));

      // 保持左上角位置不变
      newCrop.width = newSize;
      newCrop.height = newSize;

      // 边界检查
      if (newCrop.x + newCrop.width > imageSize.width) {
        newCrop.width = imageSize.width - newCrop.x;
        newCrop.height = newCrop.width;
      }
      if (newCrop.y + newCrop.height > imageSize.height) {
        newCrop.height = imageSize.height - newCrop.y;
        newCrop.width = newCrop.height;
      }
    }

    setCrop(newCrop);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawCanvas(ctx, imgRef.current, newCrop, imageSize.width, imageSize.height);
    }
  };

  const handleMouseUp = () => {
    if (dragMode) {
      setDragMode(null);
      performCrop();
    }
  };

  const performCrop = (
    cropArea = crop,
    canvasSize = imageSize
  ) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    // 创建临时画布进行裁剪
    const tempCanvas = document.createElement('canvas');
    const size = 1024; // 输出固定尺寸
    tempCanvas.width = size;
    tempCanvas.height = size;

    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    // 清除画布，确保透明背景
    ctx.clearRect(0, 0, size, size);

    // 计算原图中的裁剪区域
    const scaleX = img.width / canvasSize.width;
    const scaleY = img.height / canvasSize.height;

    ctx.drawImage(
      img,
      cropArea.x * scaleX,
      cropArea.y * scaleY,
      cropArea.width * scaleX,
      cropArea.height * scaleY,
      0,
      0,
      size,
      size
    );

    const croppedData = tempCanvas.toDataURL('image/png');
    onCropComplete(croppedData.split(',')[1]);
  };

  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="checkerboard border border-gray-300 rounded max-w-full"
      />
    </div>
  );
};

export default ImageCropper;
