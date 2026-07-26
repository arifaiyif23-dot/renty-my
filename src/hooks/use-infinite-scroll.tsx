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
  // Generation counter: incremented on every reset so that in-flight requests
  // from a previous filter set are ignored when they resolve.
  const generationRef = useRef(0);
  // Track in-flight loading synchronously to avoid the stale `loading` closure.
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    const generation = generationRef.current;
    loadingRef.current = true;
    setLoading(true);
    try {
      const newItems = await fetchFunction(page, pageSize);

      // Bail out if a reset happened while this request was in flight.
      if (generation !== generationRef.current) return;

      if (newItems.length < pageSize) {
        setHasMore(false);
      }

      setItems(prev => [...prev, ...newItems]);
      setPage(prev => prev + 1);
    } catch (err) {
      if (generation !== generationRef.current) return;
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      if (generation === generationRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [fetchFunction, page, pageSize, hasMore]);

  // Initial load (and reload after a reset when the sentinel may already be
  // visible, so the IntersectionObserver would not fire again).
  useEffect(() => {
    if (!initialLoadDone.current && items.length === 0 && !loading) {
      initialLoadDone.current = true;
      loadMore();
    }
  }, [items.length, loading, loadMore]);

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
    // Invalidate any in-flight request and reset synchronously, then allow the
    // load effect to refetch page 1 for the new filter set.
    generationRef.current += 1;
    loadingRef.current = false;
    setItems([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    setLoading(false);
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
