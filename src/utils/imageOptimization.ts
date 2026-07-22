/**
 * Image optimization utilities for better mobile performance
 */

function getNetworkQuality(): 'slow' | 'medium' | 'fast' {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) return 'fast';
  const conn = (navigator as Navigator & { connection: { effectiveType?: string } }).connection;
  if (!conn?.effectiveType) return 'fast';
  if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return 'slow';
  if (conn.effectiveType === '3g') return 'medium';
  return 'fast';
}

// Convert image to WebP format with quality optimization
export const convertToWebP = async (
  file: File,
  quality: number = 0.8
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let objectUrl: string | null = null;

    img.onload = () => {
      // Revoke object URL to free memory
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      
      // Set canvas dimensions
      canvas.width = img.width;
      canvas.height = img.height;

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw and convert to WebP
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert image'));
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image. Please ensure the file is a valid image.'));
    };
    
    objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
  });
};

// Resize image if it exceeds max dimensions
export const resizeImage = async (
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1080
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let objectUrl: string | null = null;

    img.onload = () => {
      // Revoke object URL to free memory
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      
      let { width, height } = img;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = width * ratio;
        height = height * ratio;
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to resize image'));
          }
        },
        file.type || 'image/jpeg',
        0.9
      );
    };

    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image. Please ensure the file is a valid image.'));
    };
    
    objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
  });
};

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
    const resizedType = file.type.startsWith('image/') ? file.type : 'image/jpeg';
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
