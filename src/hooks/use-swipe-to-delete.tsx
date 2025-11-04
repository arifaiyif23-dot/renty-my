import { useState, useRef, TouchEvent } from 'react';
import { haptics } from '@/utils/haptics';

interface UseSwipeToDeleteProps {
  onDelete: () => void;
  threshold?: number;
}

export function useSwipeToDelete({ onDelete, threshold = 120 }: UseSwipeToDeleteProps) {
  const [swipeDistance, setSwipeDistance] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
    const distance = touchStartX.current - touchCurrentX.current;
    
    // Only allow left swipe (positive distance)
    if (distance > 0) {
      setSwipeDistance(Math.min(distance, threshold + 20));
      
      // Haptic feedback when reaching threshold
      if (distance >= threshold && distance < threshold + 5) {
        haptics.medium();
      }
    }
  };

  const handleTouchEnd = async () => {
    if (swipeDistance >= threshold) {
      setIsDeleting(true);
      haptics.success();
      await onDelete();
    }
    
    setSwipeDistance(0);
    setIsDeleting(false);
  };

  return {
    swipeDistance,
    isDeleting,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
