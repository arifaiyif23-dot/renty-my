/**
 * Image optimization utilities for better mobile performance.
 * Handles EXIF orientation correction (e.g. iPhone photos loading sideways)
 * and HEIC/HEIF inputs via createImageBitmap where supported.
 */

function getNetworkQuality(): 'slow' | 'medium' | 'fast' {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) return 'fast';
  const conn = (navigator as Navigator & { connection: { effectiveType?: string } }).connection;
  if (!conn?.effectiveType) return 'fast';
  if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return 'slow';
  if (conn.effectiveType === '3g') return 'medium';
  return 'fast';
}

interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
}

// Load a file into a drawable source. Uses createImageBitmap with
// imageOrientation:'from-image' (honors EXIF and decodes HEIC on Safari/WebKit).
// Falls back to <img>, whose rendering also applies EXIF orientation by default.
async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      /* HEIC/encoding decode issue -> fall back to <img> */
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    let objectUrl: string | null = null;
    let settled = false;

    img.onload = () => {
      if (settled) return;
      settled = true;
      const naturalWidth = img.naturalWidth || img.width;
      const naturalHeight = img.naturalHeight || img.height;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (naturalWidth === 0 || naturalHeight === 0) {
        reject(new Error('Failed to load image. Please ensure the file is a valid image.'));
        return;
      }
      resolve({ source: img, width: naturalWidth, height: naturalHeight });
    };

    img.onerror = () => {
      if (settled) return;
      settled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image. Please ensure the file is a valid image.'));
    };

    objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
  });
}

function isHEICType(mime: string): boolean {
  return mime === 'image/heic' || mime === 'image/heif';
}

// Convert image to WebP with correct orientation
export const convertToWebP = async (
  file: File,
  quality: number = 0.8
): Promise<Blob> => {
  const loaded = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = loaded.width;
  canvas.height = loaded.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    loaded.close?.();
    throw new Error('Could not get canvas context');
  }

  ctx.drawImage(loaded.source, 0, 0);
  loaded.close?.();

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', quality));
  if (!blob) throw new Error('Failed to convert image');
  return blob;
};

// Resize image if it exceeds max dimensions, preserving orientation
export const resizeImage = async (
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1080
): Promise<Blob> => {
  const loaded = await loadImage(file);
  let { width, height } = loaded;

  // Calculate new dimensions while maintaining aspect ratio
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    loaded.close?.();
    throw new Error('Could not get canvas context');
  }

  ctx.drawImage(loaded.source, 0, 0, width, height);
  loaded.close?.();

  // HEIC input -> output as JPEG since HEIC can't be re-encoded everywhere
  const outputType = isFileType(file.type) && !isHEICType(file.type) ? file.type : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, outputType, 0.9);
  });
  if (!blob) throw new Error('Failed to resize image');
  return blob;
};

function isFileType(type: string): boolean {
  return typeof type === 'string' && type.startsWith('image/');
}

// Optimize image based on network quality
export const optimizeImage = async (file: File): Promise<Blob> => {
  try {
    const networkQuality = getNetworkQuality();
    const isSlow = networkQuality === 'slow';

    // Resize if needed
    const maxWidth = isSlow ? 1280 : 1920;
    const maxHeight = isSlow ? 720 : 1080;
    const resized = await resizeImage(file, maxWidth, maxHeight);

    // Convert to WebP for better compression
    const quality = isSlow ? 0.6 : 0.8;

    // Create a proper File object from the resized blob with correct MIME type
    const resizedType = resized.type || 'image/jpeg';
    const resizedFile = new File([resized], file.name, { type: resizedType });

    const webpBlob = await convertToWebP(resizedFile, quality);
    return webpBlob;
  } catch (error) {
    console.error('Image optimization failed:', error);
    // If optimization fails, return the original file as blob
    return file;
  }
};

// Get optimized image URL from Supabase storage
export const getOptimizedImageUrl = (
  url: string,
  options?: {
    width?: number;
    height?: number;
    quality?: number;
  }
): string => {
  if (!url) return '';

  const networkQuality = getNetworkQuality();
  const isSlow = networkQuality === 'slow';

  // Default dimensions based on network quality
  const defaultWidth = isSlow ? 800 : 1200;
  const defaultQuality = isSlow ? 60 : 80;

  const width = options?.width || defaultWidth;
  const quality = options?.quality || defaultQuality;

  // If it's a Supabase storage URL, add transformation params
  if (url.includes('supabase.co/storage')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}width=${width}&quality=${quality}&format=webp`;
  }

  return url;
};

// Generate srcSet string for responsive images
export const getSrcSet = (
  url: string,
  options?: { quality?: number }
): string | undefined => {
  if (!url || !url.includes('supabase.co/storage')) return undefined;

  const quality = options?.quality || 80;
  const widths = [320, 640, 960, 1280, 1920];
  const separator = url.includes('?') ? '&' : '?';

  return widths
    .map((w) => `${url}${separator}width=${w}&quality=${quality}&format=webp ${w}w`)
    .join(', ');
};