import { useEffect, useState, useCallback, useRef } from 'react';
import { haptics } from '@/utils/haptics';

// True if the touch started inside an element that scrolls on its own (inner
// ScrollArea, scrollable sheet, etc.) or inside a modal dialog — pull-to-refresh
// should never hijack those gestures.
function isInsideScrollableOrDialog(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  const el = target as Element;
  if (el.closest('dialog, [role="dialog"], [data-radix-dialog-content], [data-radix-scroll-area-viewport]')) return true;
  let node: Element | null = el;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll') {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

export function usePullToRefresh(onRefresh: () => Promise<void>, enabled = true) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  // Keep the latest callback without re-subscribing listeners on every render.
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const triggerRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    haptics.medium();

    try {
      await onRefreshRef.current();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      setPullDistance(0);
      pullDistanceRef.current = 0;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let touchStart = 0;
    let pullActive = false;

    const handleTouchStart = (e: TouchEvent) => {
      // Never arm pull-to-refresh over a modal, inner scroll container, or the
      // open search overlay (which locks body scroll via overflow:hidden).
      if (document.body.style.overflow === 'hidden') return;
      if (isInsideScrollableOrDialog(e.target)) return;

      if (window.scrollY === 0) {
        pullActive = true;
        touchStart = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!pullActive || isRefreshingRef.current) return;

      const currentTouch = e.touches[0].clientY;
      const distance = currentTouch - touchStart;

      if (distance > 0 && distance < 120) {
        setPullDistance(distance);
        pullDistanceRef.current = distance;
      } else if (distance <= 0) {
        setPullDistance(0);
        pullDistanceRef.current = 0;
      }
    };

    const handleTouchEnd = async () => {
      if (!pullActive) return;
      pullActive = false;
      if (pullDistanceRef.current > 80) {
        await triggerRefresh();
      } else {
        setPullDistance(0);
        pullDistanceRef.current = 0;
      }
      touchStart = 0;
    };

    const handleTouchCancel = () => {
      pullActive = false;
      setPullDistance(0);
      pullDistanceRef.current = 0;
      touchStart = 0;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [enabled, triggerRefresh]);

  // Keep ref in sync
  useEffect(() => { pullDistanceRef.current = pullDistance; }, [pullDistance]);

  // Prevent browser native pull-to-refresh interfering with our custom one
  useEffect(() => {
    if (!enabled) return;
    const el = document.documentElement;
    const prev = el.style.overscrollBehaviorY;
    el.style.overscrollBehaviorY = 'contain';
    return () => { el.style.overscrollBehaviorY = prev; };
  }, [enabled]);

  return { isRefreshing, pullDistance };
}