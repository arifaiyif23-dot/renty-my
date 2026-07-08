import { useEffect, useState, useCallback, useRef } from 'react';

interface UseInfiniteScrollProps<T> {
  fetchFunction: (page: number, pageSize: number) => Promise<T[]>;
  pageSize?: number;
  threshold?: number;
}

export function useInfiniteScroll<T>({
  fetchFunction,
  pageSize = 12,
  threshold = 100,
}: UseInfiniteScrollProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const newItems = await fetchFunction(page, pageSize);
      
      if (newItems.length < pageSize) {
        setHasMore(false);
      }

      setItems(prev => [...prev, ...newItems]);
      setPage(prev => prev + 1);
    } catch (error) {
      console.error('Error loading more items:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, page, pageSize, loading, hasMore]);

  // Initial load on mount
  useEffect(() => {
    if (items.length === 0 && !loading) {
      loadMore();
    }
  }, []);

  // Create observer AND observe sentinel in one effect so observation is always paired
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { rootMargin: `${threshold}px` }
    );
    observerRef.current = observer;

    const sentinel = sentinelRef.current;
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading, loadMore, threshold, sentinelRef.current]);

  const reset = useCallback(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
  }, []);

  return {
    items,
    loading,
    hasMore,
    sentinelRef,
    reset,
  };
}
