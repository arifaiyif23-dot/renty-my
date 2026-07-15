import { useEffect, useState, useCallback, useRef } from 'react';

export interface UseInfiniteScrollProps<T> {
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
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelCallbackRef = useRef<HTMLDivElement | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, page, pageSize, loading, hasMore]);

  useEffect(() => {
    if (!initialLoadDone.current && items.length === 0 && !loading) {
      initialLoadDone.current = true;
      loadMore();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    const sentinel = sentinelCallbackRef.current;
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading, loadMore, threshold]);

  const setSentinelRef = useCallback((node: HTMLDivElement | null) => {
    sentinelCallbackRef.current = node;
    if (observerRef.current && node) {
      observerRef.current.disconnect();
      observerRef.current.observe(node);
    }
  }, []);

  const reset = useCallback(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    initialLoadDone.current = false;
  }, []);

  return {
    items,
    loading,
    hasMore,
    error,
    sentinelRef: sentinelCallbackRef,
    setSentinelRef,
    reset,
  };
}
