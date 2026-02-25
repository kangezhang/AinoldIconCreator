import React, { useState, useRef, useEffect } from 'react';

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedImage: string) => void;
}

type DragMode = 'move' | 'resize' | null;

const ImageCropper: React.FC<ImageCropperProps> = ({ image, onCropComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const imgRef = useRef<HTMLImageElement>(new Image());

  useEffect(() => {
    const img = imgRef.current;
    img.src = image;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
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

      // 初始化裁剪区域为正方形
      const size = Math.min(width, height);
      const x = (width - size) / 2;
      const y = (height - size) / 2;
      setCrop({ x, y, width: size, height: size });

      drawCanvas(ctx, img, { x, y, width: size, height: size }, width, height);
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
    ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

    // 绘制遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 清除裁剪区域
    ctx.clearRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
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

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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

  const performCrop = () => {
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

    // 计算原图中的裁剪区域
    const scaleX = img.width / imageSize.width;
    const scaleY = img.height / imageSize.height;

    ctx.drawImage(
      img,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
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
        className="border border-gray-300 rounded max-w-full"
      />
    </div>
  );
};

export default ImageCropper;
