import React, { useState, useRef, useEffect } from 'react';
import { Download, Upload, Eraser, Loader2, Pipette, Check, Crop } from 'lucide-react';
import ImageCropper, { type ImageCropperHandle } from './components/ImageCropper';
import type { RgbColor } from './types';

function App() {
  const [image, setImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [bgRemovedImage, setBgRemovedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isPickingColor, setIsPickingColor] = useState(false);
  const [selectedColor, setSelectedColor] = useState<RgbColor | null>(null);
  const [tolerance, setTolerance] = useState(40);
  const [isCropPending, setIsCropPending] = useState(false);
  const [applyCropToImage, setApplyCropToImage] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropperRef = useRef<ImageCropperHandle>(null);

  const handleImageSelect = (imageData: string) => {
    setImage(imageData);
    setCroppedImage(null);
    setBgRemovedImage(null);
    setSelectedColor(null);
    setIsPickingColor(false);
    setIsCropPending(false);
    setApplyCropToImage(false);
    setIsCropping(true);
  };

  const handleCropComplete = (croppedData: string) => {
    setCroppedImage(croppedData);
    setBgRemovedImage(null);
    if (applyCropToImage) {
      setImage(`data:image/png;base64,${croppedData}`);
      setApplyCropToImage(false);
      setIsCropping(false);
      setIsCropPending(false);
    }
  };

  const handleColorPick = (color: RgbColor) => {
    setSelectedColor(color);
    setIsPickingColor(false);
  };

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleApplyCrop = () => {
    if (!image) return;
    if (!isCropping) {
      setIsCropping(true);
      return;
    }
    if (!isCropPending) return;
    setApplyCropToImage(true);
    cropperRef.current?.applyCrop();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      handleImageSelect(result);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleGenerateIcons = async () => {
    const sourceImage = bgRemovedImage || croppedImage;
    if (!sourceImage) return;

    if (!window.electronAPI?.generateIcons) {
      alert('Export is unavailable. Please run the desktop app build.');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await window.electronAPI.generateIcons(sourceImage, 'icon');
      if (result.success) {
        alert(`图标生成成功！\n保存位置: ${result.path}`);
      } else {
        alert(`生成失败: ${result.message}`);
      }
    } catch (error) {
      alert(`生成失败: ${(error as Error).message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRemoveColor = async () => {
    if (!croppedImage) return;

    if (!selectedColor) {
      alert('Pick a background color first.');
      return;
    }

    if (!window.electronAPI?.removeColor) {
      alert('Color removal is unavailable. Please run the desktop app build.');
      return;
    }

    setIsRemovingBg(true);
    try {
      // 提取纯 base64（移除 data URL 前缀）
      const pureBase64 = croppedImage.includes(',')
        ? croppedImage.split(',')[1]
        : croppedImage;

      const result = await window.electronAPI.removeColor(pureBase64, selectedColor, tolerance);
      if (result.success && result.imageBase64) {
        const removedDataUrl = `data:image/png;base64,${result.imageBase64}`;
        setBgRemovedImage(result.imageBase64);
        setImage(removedDataUrl);
        setCroppedImage(removedDataUrl);
      } else {
        alert(`Remove color failed: ${result.message}`);
      }
    } catch (error) {
      alert(`Remove color failed: ${(error as Error).message}`);
    } finally {
      setIsRemovingBg(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!image) return;
      const target = event.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (isEditable) return;

      if (event.key === 'Enter') {
        if (!isCropping || !isCropPending) return;
        event.preventDefault();
        setApplyCropToImage(true);
        cropperRef.current?.applyCrop();
      }

      if (event.key === 'Escape') {
        if (!isCropping) return;
        event.preventDefault();
        setIsCropping(false);
        setIsCropPending(false);
        setApplyCropToImage(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [image, isCropping, isCropPending]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="w-full max-w-[560px]">
        <div className="bg-white rounded-lg shadow-lg p-4">
          <div className="flex flex-col items-center gap-4">
            {image ? (
              <ImageCropper
                key={image}
                image={image}
                onCropComplete={handleCropComplete}
                isPickingColor={isPickingColor}
                onColorPick={handleColorPick}
                onPendingChange={setIsCropPending}
                isCropping={isCropping}
                ref={cropperRef}
              />
            ) : (
              <div className="checkerboard border border-gray-300 rounded w-full max-w-[500px] aspect-square" />
            )}
            <div className="flex gap-3 w-full justify-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={handlePickImage}
                aria-label="Select image"
                title="Select image"
                className="flex items-center justify-center w-11 h-11 bg-white hover:bg-gray-100 border border-gray-300 rounded-full transition-colors shadow-sm"
              >
                <Upload size={18} />
              </button>
              <button
                onClick={handleApplyCrop}
                disabled={!image || (isCropping && !isCropPending)}
                aria-label={isCropping ? 'Apply crop' : 'Enter crop mode'}
                title={
                  !image
                    ? 'Select image'
                    : !isCropping
                      ? 'Enter crop mode (Esc to exit)'
                      : isCropPending
                        ? 'Apply crop (Enter)'
                        : 'Adjust selection or press Esc to exit'
                }
                className={`flex items-center justify-center w-11 h-11 bg-white hover:bg-gray-100 border border-gray-300 rounded-full transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  isCropPending ? 'ring-2 ring-indigo-400' : ''
                }`}
              >
                {isCropping ? <Check size={18} /> : <Crop size={18} />}
              </button>
              <button
                onClick={() => setIsPickingColor((prev) => !prev)}
                disabled={!image}
                aria-label="Pick background color"
                title="Pick background color"
                className={`flex items-center justify-center w-11 h-11 bg-white hover:bg-gray-100 border border-gray-300 rounded-full transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  isPickingColor ? 'ring-2 ring-indigo-400' : ''
                }`}
              >
                <Pipette size={18} />
              </button>
              <div
                className="w-4 h-4 rounded-full border border-gray-300"
                title={
                  selectedColor
                    ? `rgb(${selectedColor.r}, ${selectedColor.g}, ${selectedColor.b})`
                    : 'No color selected'
                }
                style={{
                  backgroundColor: selectedColor
                    ? `rgb(${selectedColor.r}, ${selectedColor.g}, ${selectedColor.b})`
                    : 'transparent'
                }}
              />
              <button
                onClick={handleRemoveColor}
                disabled={!croppedImage || isRemovingBg}
                aria-label="Remove background color"
                title="Remove background color"
                className="flex items-center justify-center w-11 h-11 bg-white hover:bg-gray-100 border border-gray-300 rounded-full transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRemovingBg ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Eraser size={18} />
                )}
              </button>
              <button
                onClick={handleGenerateIcons}
                disabled={!(bgRemovedImage || croppedImage) || isGenerating}
                aria-label="Export icons"
                title="Export icons"
                className="flex items-center justify-center w-11 h-11 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-full transition-colors disabled:cursor-not-allowed shadow-sm"
              >
                <Download size={18} />
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 w-full">
              <input
                type="range"
                min={0}
                max={100}
                value={tolerance}
                onChange={(event) => setTolerance(Number(event.target.value))}
                aria-label="Color tolerance"
                className="w-40"
              />
              <span className="text-xs text-gray-500 w-8 text-right">{tolerance}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
