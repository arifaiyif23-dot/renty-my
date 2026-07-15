import { format } from 'date-fns';

/**
 * Performance utilities for mobile optimization
 */

// Check network connection quality
export const getNetworkQuality = (): 'slow' | 'fast' | 'unknown' => {
  if (!('connection' in navigator)) return 'unknown';
  
  const connection = (navigator as { connection?: { effectiveType?: string } }).connection;
  const effectiveType = connection?.effectiveType;
  
  if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    return 'slow';
  }
  
  return 'fast';
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
