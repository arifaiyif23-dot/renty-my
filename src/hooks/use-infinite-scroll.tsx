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

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { rootMargin: `${threshold}px` }
    );

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, loadMore, threshold]);

  useEffect(() => {
    const currentSentinel = sentinelRef.current;
    const currentObserver = observerRef.current;

    if (currentSentinel && currentObserver) {
      currentObserver.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel && currentObserver) {
        currentObserver.unobserve(currentSentinel);
      }
    };
  }, []);

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
