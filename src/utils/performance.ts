import { format } from 'date-fns';

/**
 * Performance utilities for mobile optimization
 */

// Check if user prefers reduced motion
export const prefersReducedMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Check network connection quality
export const getNetworkQuality = (): 'slow' | 'fast' | 'unknown' => {
  if (!('connection' in navigator)) return 'unknown';
  
  const connection = (navigator as any).connection;
  const effectiveType = connection?.effectiveType;
  
  if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    return 'slow';
  }
  
  return 'fast';
};

// Passive event listener options
export const passiveEventOptions: AddEventListenerOptions = {
  passive: true,
  capture: false,
};

// Optimize images based on network quality
export const getImageQuality = (): 'low' | 'high' => {
  const quality = getNetworkQuality();
  return quality === 'slow' ? 'low' : 'high';
};

// Safe date formatting that never crashes on invalid dates
export function safeFormat(dateStr: string | null | undefined, fmt: string, fallback = "—"): string {
  if (!dateStr) return fallback;
  try {
    return format(new Date(dateStr), fmt);
  } catch {
    return fallback;
  }
}
