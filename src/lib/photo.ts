export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
  mimeType: string;
}

/**
 * Resize and compress an uploaded image entirely in the browser (canvas),
 * so nothing is ever sent to a server. Produces a JPEG capped at
 * `maxDimension` on its longest side.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 320,
  quality = 0.82,
): Promise<CompressedImage> {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);

  let { width, height } = image;
  if (width > height && width > maxDimension) {
    height = Math.round((height / width) * maxDimension);
    width = maxDimension;
  } else if (height >= width && height > maxDimension) {
    width = Math.round((width / height) * maxDimension);
    height = maxDimension;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not available in this browser.');
  }
  ctx.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
  });

  if (!blob) {
    throw new Error('Failed to compress image.');
  }

  return { blob, width, height, mimeType: 'image/jpeg' };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for preview/compression.'));
    img.src = src;
  });
}

/** Convert a stored photo Blob into an object URL for <img> display. Caller should revoke it when done. */
export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/** Compute initials (max 2 chars) to use as a fallback avatar when no photo exists. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
