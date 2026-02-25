import React from 'react';

interface IconPreviewProps {
  croppedImage: string | null;
}

const IconPreview: React.FC<IconPreviewProps> = ({ croppedImage }) => {
  const sizes = [16, 32, 64, 128, 256, 512];

  if (!croppedImage) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <p className="text-gray-500">裁剪图片后将显示预览</p>
      </div>
    );
  }

  const imageUrl = `data:image/png;base64,${croppedImage}`;

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {sizes.map((size) => (
          <div
            key={size}
            className="flex flex-col items-center p-4 bg-gray-50 rounded-lg"
          >
            <img
              src={imageUrl}
              alt={`${size}x${size}`}
              style={{ width: size, height: size }}
              className="mb-2"
            />
            <span className="text-xs text-gray-600">{size}x{size}</span>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          将生成的尺寸:
        </h3>
        <div className="text-xs text-gray-600 space-y-1">
          <p>• Windows (.ico): 16, 32, 48, 64, 128, 256</p>
          <p>• macOS (.icns): 16, 32, 64, 128, 256, 512, 1024</p>
        </div>
      </div>
    </div>
  );
};

export default IconPreview;
