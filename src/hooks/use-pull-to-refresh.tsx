import { useEffect, useState, useCallback, useRef } from 'react';

export function usePullToRefresh(onRefresh: () => Promise<void>, enabled = true) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const pullDistanceRef = useRef(0);

  const triggerRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
    
    try {
      await onRefresh();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [onRefresh, isRefreshing]);

  useEffect(() => {
    if (!enabled) return;

    let touchStart = 0;
    let isAtTop = false;

    const handleTouchStart = (e: TouchEvent) => {
      isAtTop = window.scrollY === 0;
      if (isAtTop) {
        touchStart = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isAtTop || isRefreshing) return;
      
      const currentTouch = e.touches[0].clientY;
      const distance = currentTouch - touchStart;
      
      if (distance > 0 && distance < 120) {
        setPullDistance(distance);
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistanceRef.current > 80) {
        await triggerRefresh();
      } else {
        setPullDistance(0);
      }
      touchStart = 0;
      isAtTop = false;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, triggerRefresh, isRefreshing]);

  // Keep ref in sync
  useEffect(() => { pullDistanceRef.current = pullDistance; }, [pullDistance]);

  return { isRefreshing, pullDistance };
}
