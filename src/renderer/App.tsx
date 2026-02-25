import React, { useState } from 'react';
import { RotateCcw, Download } from 'lucide-react';
import ImageUploader from './components/ImageUploader';
import ImageCropper from './components/ImageCropper';

function App() {
  const [image, setImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleImageSelect = (imageData: string) => {
    setImage(imageData);
    setCroppedImage(null);
  };

  const handleCropComplete = (croppedData: string) => {
    setCroppedImage(croppedData);
  };

  const handleGenerateIcons = async () => {
    if (!croppedImage) return;

    if (!window.electronAPI?.generateIcons) {
      alert('Export is unavailable. Please run the desktop app build.');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await window.electronAPI.generateIcons(croppedImage, 'icon');
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

  const handleReset = () => {
    setImage(null);
    setCroppedImage(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-lg shadow-lg p-6">
          {!image ? (
            <ImageUploader onImageSelect={handleImageSelect} />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <ImageCropper
                image={image}
                onCropComplete={handleCropComplete}
              />
              <div className="flex gap-3 w-full justify-center">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors shadow-sm font-medium"
                >
                  <RotateCcw size={18} />
                  重新选择
                </button>
                <button
                  onClick={handleGenerateIcons}
                  disabled={!croppedImage || isGenerating}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed shadow-sm font-medium"
                >
                  <Download size={18} />
                  {isGenerating ? '生成中...' : '导出图标'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
