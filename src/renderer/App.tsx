import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Download, Upload, Eraser, Loader2, Pipette, Check, Crop,
  Undo2, Redo2, MousePointer, RectangleHorizontal, Circle,
  PenLine, Brush, Scissors, X, Plus, Minus, Square
} from 'lucide-react';
import { useHistory, type AppSnapshot } from './hooks/useHistory';
import { useSelectionMask } from './hooks/useSelectionMask';
import { isMaskEmpty } from './utils/maskUtils';
import ImageCropper, { type ImageCropperHandle } from './components/ImageCropper';
import { ToolGroup } from './components/ToolGroup';
import type { RgbColor } from './types';
import type { ActiveTool, SelectionMask } from './types/selection';

function App() {
  const [image, setImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [bgRemovedImage, setBgRemovedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [selectedColor, setSelectedColor] = useState<RgbColor | null>(null);
  const [tolerance, setTolerance] = useState(15);
  const [isCropPending, setIsCropPending] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>('none');
  const applyCropToImageRef = useRef(false);
  const initCropRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropperRef = useRef<ImageCropperHandle>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const {
    selectionMask, setSelectionMask,
    selectionMode, setSelectionMode,
    commitToolResult, clearSelection, selectAll,
  } = useSelectionMask();

  const { saveSnapshot, undo, redo, canUndo, canRedo } = useHistory({
    image: null, croppedImage: null, bgRemovedImage: null,
    selectedColor: null, tolerance: 15,
    selectionMask: null, operationType: 'initial',
  });

  const currentSnapshot = useCallback((): AppSnapshot => ({
    image, croppedImage, bgRemovedImage, selectedColor, tolerance,
    selectionMask, operationType: 'initial',
  }), [image, croppedImage, bgRemovedImage, selectedColor, tolerance, selectionMask]);

  const applySnapshot = (snapshot: AppSnapshot) => {
    setImage(snapshot.image);
    setCroppedImage(snapshot.croppedImage);
    setBgRemovedImage(snapshot.bgRemovedImage);
    setSelectedColor(snapshot.selectedColor);
    setTolerance(snapshot.tolerance);
    setSelectionMask(snapshot.selectionMask);
    setActiveTool('none');
    setIsCropPending(false);
  };

  const handleUndo = () => {
    const snapshot = undo(currentSnapshot());
    if (snapshot) applySnapshot(snapshot);
  };

  const handleRedo = () => {
    const snapshot = redo(currentSnapshot());
    if (snapshot) applySnapshot(snapshot);
  };

  const handleImageSelect = (imageData: string) => {
    saveSnapshot(currentSnapshot());
    setImage(imageData);
    setCroppedImage(null);
    setBgRemovedImage(null);
    setSelectedColor(null);
    setActiveTool('crop');
    setIsCropPending(false);
    applyCropToImageRef.current = false;
    initCropRef.current = true;
    clearSelection();
  };

  const handleCropComplete = (croppedData: string) => {
    if (initCropRef.current) {
      initCropRef.current = false;
      setCroppedImage(`data:image/png;base64,${croppedData}`);
      return;
    }
    if (applyCropToImageRef.current) {
      saveSnapshot({ ...currentSnapshot(), operationType: 'crop' });
      const dataUrl = `data:image/png;base64,${croppedData}`;
      setImage(dataUrl);
      setCroppedImage(dataUrl);
      setBgRemovedImage(null);
      clearSelection();
      applyCropToImageRef.current = false;
      setActiveTool('none');
      setIsCropPending(false);
    }
  };

  const handleColorPick = (color: RgbColor) => {
    saveSnapshot(currentSnapshot());
    setSelectedColor(color);
    setActiveTool('none');
  };

  const handlePointErase = async (imageX: number, imageY: number) => {
    if (!croppedImage) return;
    if (!window.electronAPI?.removeColorAtPoint) {
      alert('Point erase is unavailable. Please run the desktop app build.');
      return;
    }
    setActiveTool('none');
    setIsRemovingBg(true);
    try {
      const pureBase64 = croppedImage.includes(',') ? croppedImage.split(',')[1] : croppedImage;
      const result = await window.electronAPI.removeColorAtPoint(pureBase64, imageX, imageY, tolerance);
      if (result.success && result.imageBase64) {
        const removedDataUrl = `data:image/png;base64,${result.imageBase64}`;
        saveSnapshot({ ...currentSnapshot(), operationType: 'removeColorPoint' });
        setBgRemovedImage(result.imageBase64);
        setImage(removedDataUrl);
        setCroppedImage(removedDataUrl);
      } else {
        alert(`Point erase failed: ${result.message}`);
      }
    } catch (error) {
      alert(`Point erase failed: ${(error as Error).message}`);
    } finally {
      setIsRemovingBg(false);
    }
  };

  const handlePickImage = () => fileInputRef.current?.click();

  const handleApplyCrop = () => {
    if (!image) return;
    if (activeTool !== 'crop') {
      setActiveTool('crop');
      return;
    }
    if (!isCropPending) return;
    applyCropToImageRef.current = true;
    cropperRef.current?.applyCrop();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => handleImageSelect(e.target?.result as string);
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
      if (result.success) alert(`图标生成成功！\n保存位置: ${result.path}`);
      else alert(`生成失败: ${result.message}`);
    } catch (error) {
      alert(`生成失败: ${(error as Error).message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRemoveColor = async () => {
    if (!croppedImage) return;
    if (!selectedColor) { alert('Pick a background color first.'); return; }
    if (!window.electronAPI?.removeColor) {
      alert('Color removal is unavailable. Please run the desktop app build.');
      return;
    }
    setIsRemovingBg(true);
    try {
      const pureBase64 = croppedImage.includes(',') ? croppedImage.split(',')[1] : croppedImage;
      const result = await window.electronAPI.removeColor(pureBase64, selectedColor, tolerance);
      if (result.success && result.imageBase64) {
        const removedDataUrl = `data:image/png;base64,${result.imageBase64}`;
        saveSnapshot({ ...currentSnapshot(), operationType: 'removeColorEdge' });
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

  const handleApplySelection = async () => {
    if (!selectionMask || isMaskEmpty(selectionMask) || !croppedImage) return;
    if (!window.electronAPI?.applySelection) {
      alert('Apply selection is unavailable. Please run the desktop app build.');
      return;
    }
    setIsRemovingBg(true);
    try {
      const pureBase64 = croppedImage.includes(',') ? croppedImage.split(',')[1] : croppedImage;
      const result = await window.electronAPI.applySelection(
        pureBase64,
        Array.from(selectionMask.data),
        selectionMask.width,
        selectionMask.height
      );
      if (result.success && result.imageBase64) {
        const dataUrl = `data:image/png;base64,${result.imageBase64}`;
        saveSnapshot({ ...currentSnapshot(), operationType: 'applySelection' });
        setImage(dataUrl);
        setCroppedImage(dataUrl);
        setBgRemovedImage(result.imageBase64);
        clearSelection();
      } else {
        alert(`Apply selection failed: ${result.message}`);
      }
    } catch (error) {
      alert(`Apply selection failed: ${(error as Error).message}`);
    } finally {
      setIsRemovingBg(false);
    }
  };

  const handleToolCommit = (mask: SelectionMask) => {
    commitToolResult(mask);
  };

  const toggleTool = (tool: ActiveTool) => {
    setActiveTool(prev => prev === tool ? 'none' : tool);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!image) return;
      const target = event.target as HTMLElement | null;
      const isEditable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isEditable) return;

      if ((event.ctrlKey || event.metaKey) && event.key === 'z') { event.preventDefault(); handleUndo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key === 'y') { event.preventDefault(); handleRedo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault();
        if (imageSize.width > 0) selectAll(imageSize.width, imageSize.height);
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectionMask && !isMaskEmpty(selectionMask)) { event.preventDefault(); handleApplySelection(); return; }
      }

      if (event.key === 'Enter') {
        if (activeTool === 'crop' && isCropPending) {
          event.preventDefault();
          applyCropToImageRef.current = true;
          cropperRef.current?.applyCrop();
        }
      }

      if (event.key === 'Escape') {
        if (selectionMask) { clearSelection(); return; }
        if (activeTool === 'crop') {
          event.preventDefault();
          setActiveTool('none');
          setIsCropPending(false);
          applyCropToImageRef.current = false;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [image, activeTool, isCropPending, selectionMask, imageSize, handleUndo, handleRedo]);

  const isCropping = activeTool === 'crop';
  const hasSelection = selectionMask !== null && !isMaskEmpty(selectionMask);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-start p-4 gap-4">
      <div className="bg-white rounded-lg shadow-lg p-4 w-[532px] h-[532px] flex items-center justify-center">
        {image ? (
          <ImageCropper
            key={image}
            image={image}
            onCropComplete={handleCropComplete}
            activeTool={activeTool}
            selectionMask={selectionMask}
            selectionMode={selectionMode}
            onToolCommit={handleToolCommit}
            onColorPick={handleColorPick}
            onPendingChange={setIsCropPending}
            onPointErase={handlePointErase}
            onImageSizeChange={(w, h) => setImageSize({ width: w, height: h })}
            ref={cropperRef}
          />
        ) : (
          <div className="checkerboard border border-gray-300 rounded w-[500px] h-[500px]" />
        )}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow-lg p-3 w-fit">
        <div className="flex gap-2 items-center justify-center">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

          {/* Undo / Redo */}
          <button onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" className="tool-btn disabled:opacity-50 disabled:cursor-not-allowed"><Undo2 size={16} /></button>
          <button onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" className="tool-btn disabled:opacity-50 disabled:cursor-not-allowed"><Redo2 size={16} /></button>

          <div className="w-px h-8 bg-gray-200 mx-1" />

          {/* File / Crop */}
          <button onClick={handlePickImage} title="Open image" className="tool-btn"><Upload size={16} /></button>
          <button
            onClick={handleApplyCrop}
            disabled={!image || (isCropping && !isCropPending)}
            title={!isCropping ? 'Enter crop mode' : isCropPending ? 'Apply crop (Enter)' : 'Adjust or Esc to exit'}
            className={`tool-btn disabled:opacity-50 disabled:cursor-not-allowed ${isCropping ? 'ring-2 ring-indigo-400' : ''}`}
          >
            {isCropping ? <Check size={16} /> : <Crop size={16} />}
          </button>

          <div className="w-px h-8 bg-gray-200 mx-1" />

          {/* Selection tool group (long-press to switch sub-tool) */}
          <ToolGroup
            disabled={!image}
            activeId={['rectSelect','ellipseSelect','lassoSelect','paintSelect'].includes(activeTool) ? activeTool : null}
            onSelect={id => setActiveTool(id as ActiveTool)}
            items={[
              { id: 'rectSelect',    icon: <RectangleHorizontal size={16} />, title: 'Rectangle select' },
              { id: 'ellipseSelect', icon: <Circle size={16} />,              title: 'Ellipse select' },
              { id: 'lassoSelect',   icon: <PenLine size={16} />,             title: 'Lasso select' },
              { id: 'paintSelect',   icon: <Brush size={16} />,               title: 'Paint select' },
            ]}
          />

          {/* Selection mode: compact 3-button strip */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden shadow-sm flex-shrink-0">
            {([
              { mode: 'replace', icon: <Square size={13} />,  title: 'Replace selection' },
              { mode: 'add',     icon: <Plus size={13} />,    title: 'Add to selection' },
              { mode: 'subtract',icon: <Minus size={13} />,   title: 'Subtract from selection' },
            ] as const).map(({ mode, icon, title }) => (
              <button
                key={mode}
                onClick={() => setSelectionMode(mode)}
                title={title}
                className={`flex items-center justify-center w-7 h-9 transition-colors text-gray-600
                  ${selectionMode === mode ? 'bg-blue-100 text-blue-600' : 'bg-white hover:bg-gray-100'}`}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Apply / clear selection */}
          <button onClick={handleApplySelection} disabled={!hasSelection || isRemovingBg} title="Delete selected area (Delete)" className="tool-btn disabled:opacity-50 disabled:cursor-not-allowed">
            {isRemovingBg ? <Loader2 size={16} className="animate-spin" /> : <Scissors size={16} />}
          </button>
          <button onClick={clearSelection} disabled={!hasSelection} title="Clear selection (Esc)" className="tool-btn disabled:opacity-50 disabled:cursor-not-allowed"><X size={16} /></button>

          <div className="w-px h-8 bg-gray-200 mx-1" />

          {/* Color / erase tool group */}
          <button onClick={() => toggleTool('colorPick')} disabled={!image} title="Pick background color" className={`tool-btn disabled:opacity-50 ${activeTool === 'colorPick' ? 'ring-2 ring-indigo-400' : ''}`}><Pipette size={16} /></button>
          <div
            className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
            title={selectedColor ? `rgb(${selectedColor.r}, ${selectedColor.g}, ${selectedColor.b})` : 'No color selected'}
            style={{ backgroundColor: selectedColor ? `rgb(${selectedColor.r}, ${selectedColor.g}, ${selectedColor.b})` : 'transparent' }}
          />

          <ToolGroup
            disabled={!croppedImage || isRemovingBg}
            activeId={activeTool === 'pointErase' ? 'pointErase' : null}
            onSelect={id => {
              if (id === 'eraseEdge') handleRemoveColor();
              else setActiveTool(id as ActiveTool);
            }}
            items={[
              { id: 'eraseEdge',  icon: isRemovingBg ? <Loader2 size={16} className="animate-spin" /> : <Eraser size={16} />,       title: 'Remove background (flood from edges)' },
              { id: 'pointErase', icon: <MousePointer size={16} />, title: 'Click to erase region (flood fill from point)' },
            ]}
          />

          {/* Tolerance */}
          <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
            <span>Tol</span>
            <input
              type="range" min={1} max={80} value={tolerance}
              onChange={e => setTolerance(Number(e.target.value))}
              className="w-14 h-1 accent-indigo-500"
              title={`Tolerance: ${tolerance}`}
            />
            <span className="w-5 text-right">{tolerance}</span>
          </div>

          <div className="w-px h-8 bg-gray-200 mx-1" />

          {/* Export */}
          <button onClick={handleGenerateIcons} disabled={!(bgRemovedImage || croppedImage) || isGenerating} title="Export icons" className="tool-btn bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white disabled:cursor-not-allowed">
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
