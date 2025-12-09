import { useState, useRef, useCallback } from 'react';

interface UseSwipeTabsOptions {
  tabs: string[];
  initialTab?: string;
  threshold?: number;
  onTabChange?: (tab: string) => void;
}

export function useSwipeTabs({ tabs, initialTab, threshold = 50, onTabChange }: UseSwipeTabsOptions) {
  const [activeTab, setActiveTab] = useState(initialTab || tabs[0]);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current;
    const currentIndex = tabs.indexOf(activeTab);

    if (Math.abs(diff) > threshold) {
      if (diff > 0 && currentIndex < tabs.length - 1) {
        // Swipe left - next tab
        const newTab = tabs[currentIndex + 1];
        setActiveTab(newTab);
        onTabChange?.(newTab);
      } else if (diff < 0 && currentIndex > 0) {
        // Swipe right - previous tab
        const newTab = tabs[currentIndex - 1];
        setActiveTab(newTab);
        onTabChange?.(newTab);
      }
    }

    touchStartX.current = 0;
    touchEndX.current = 0;
  }, [activeTab, tabs, threshold, onTabChange]);

  const setTab = useCallback((tab: string) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  }, [onTabChange]);

  return {
    activeTab,
    setTab,
    swipeHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
