/** Longest side of a saved thumbnail, in pixels. Small enough for lists and print, big enough to read. */
export const THUMBNAIL_EDGE = 480;

/** Size of a thumbnail that fits inside `maxEdge` while keeping the aspect ratio. Never upscales. */
export function thumbnailSize(width: number, height: number, maxEdge = THUMBNAIL_EDGE): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Draws a source onto a canvas at thumbnail size and encodes it as JPEG. Returns undefined when the browser
 * cannot decode or encode the image, so a photo is still saved without a thumbnail.
 */
export async function encodeThumbnail(source: CanvasImageSource, width: number, height: number): Promise<Blob | undefined> {
  try {
    const size = thumbnailSize(width, height);
    if (size.width === 0) return undefined;
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(source, 0, 0, size.width, size.height);
    return await new Promise<Blob | undefined>((resolve) => canvas.toBlob((blob) => resolve(blob ?? undefined), 'image/jpeg', 0.85));
  } catch {
    return undefined;
  }
}

/** Thumbnail for a picked file. Undefined when the file cannot be decoded (for example a HEIC file in some browsers). */
export async function thumbnailForFile(file: Blob): Promise<Blob | undefined> {
  try {
    const bitmap = await createImageBitmap(file);
    const thumb = await encodeThumbnail(bitmap, bitmap.width, bitmap.height);
    bitmap.close();
    return thumb;
  } catch {
    return undefined;
  }
}
