import sharp from 'sharp';

/**
 * Apply a selection mask to an image: zero alpha for all selected pixels.
 * maskData is in canvas-display coordinates; it is scaled to image coordinates internally.
 */
export async function applySelectionToImage(
  imageBase64: string,
  maskData: number[],
  maskWidth: number,
  maskHeight: number
): Promise<string> {
  const imageBuffer = Buffer.from(imageBase64, 'base64');
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const imgWidth = info.width;
  const imgHeight = info.height;
  const scaleX = maskWidth / imgWidth;
  const scaleY = maskHeight / imgHeight;

  for (let imgY = 0; imgY < imgHeight; imgY++) {
    for (let imgX = 0; imgX < imgWidth; imgX++) {
      const maskX = Math.min(maskWidth - 1, Math.floor(imgX * scaleX));
      const maskY = Math.min(maskHeight - 1, Math.floor(imgY * scaleY));
      if (maskData[maskY * maskWidth + maskX] > 0) {
        data[(imgY * imgWidth + imgX) * 4 + 3] = 0;
      }
    }
  }

  const pngBuffer = await sharp(Buffer.from(data), {
    raw: { width: imgWidth, height: imgHeight, channels: 4 },
  })
    .png()
    .toBuffer();

  return pngBuffer.toString('base64');
}
