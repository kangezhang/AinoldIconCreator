import React, { useCallback } from 'react';
import { Upload, Image } from 'lucide-react';

interface ImageUploaderProps {
  onImageSelect: (imageData: string) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelect }) => {
  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        alert('请选择图片文件');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        onImageSelect(result);
      };
      reader.readAsDataURL(file);
    },
    [onImageSelect]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const file = event.dataTransfer.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        alert('请选择图片文件');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        onImageSelect(result);
      };
      reader.readAsDataURL(file);
    },
    [onImageSelect]
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-indigo-400 transition-colors cursor-pointer flex flex-col items-center justify-center"
      style={{ minHeight: '350px' }}
    >
      <div className="mb-4">
        <Image className="mx-auto h-16 w-16 text-gray-400" strokeWidth={1.5} />
      </div>
      <p className="text-lg text-gray-700 mb-2 font-medium">
        拖放图片到这里
      </p>
      <p className="text-gray-500 mb-4">或</p>
      <label className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer transition-colors font-medium shadow-sm">
        <Upload size={18} />
        选择图片
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>
      <p className="text-sm text-gray-500 mt-4">
        支持 PNG, JPG, JPEG 等格式
      </p>
    </div>
  );
};

export default ImageUploader;
