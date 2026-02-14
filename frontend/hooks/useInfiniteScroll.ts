'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface InfiniteScrollOptions<T> {
  /** Function to fetch data for a given page */
  fetchFn: (page: number) => Promise<{
    success: boolean;
    items: T[];
    hasNext: boolean;
  }>;
  /** Optional key to reset data when it changes (e.g., genreSlug) */
  resetKey?: string;
  /** Initial page number (default: 1) */
  initialPage?: number;
}

interface InfiniteScrollResult<T> {
  items: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasNext: boolean;
  sentinelRef: React.RefObject<HTMLDivElement>;
  reset: () => void;
}

/**
 * Custom hook for implementing infinite scroll with IntersectionObserver
 * 
 * @example
 * const { items, isLoading, isLoadingMore, hasNext, sentinelRef } = useInfiniteScroll({
 *   fetchFn: async (page) => {
 *     const response = await komikApi.getList(page);
 *     return { success: response.success, items: response.comics, hasNext: response.hasNext };
 *   }
 * });
 */
export function useInfiniteScroll<T>({
  fetchFn,
  resetKey = '',
  initialPage = 1
}: InfiniteScrollOptions<T>): InfiniteScrollResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(initialPage);
  const [hasNext, setHasNext] = useState(true);
  
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset function
  const reset = useCallback(() => {
    setItems([]);
    setPage(initialPage);
    setHasNext(true);
    setIsLoading(true);
  }, [initialPage]);

  // Initial fetch (and refetch when resetKey changes)
  useEffect(() => {
    const fetchInitial = async () => {
      setIsLoading(true);
      setItems([]);
      setPage(initialPage);
      
      try {
        const response = await fetchFn(initialPage);
        if (response.success) {
          setItems(response.items);
          setHasNext(response.hasNext);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchInitial();
  }, [resetKey, fetchFn, initialPage]);

  // Fetch more function
  const fetchMore = useCallback(async () => {
    if (isLoadingMore || !hasNext) return;
    
    setIsLoadingMore(true);
    const nextPage = page + 1;
    
    try {
      const response = await fetchFn(nextPage);
      if (response.success) {
        setItems(prev => [...prev, ...response.items]);
        setHasNext(response.hasNext);
        setPage(nextPage);
      }
    } catch (error) {
      console.error('Error fetching more data:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, hasNext, isLoadingMore, fetchFn]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNext && !isLoadingMore && !isLoading) {
          fetchMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchMore, hasNext, isLoadingMore, isLoading]);

  return {
    items,
    isLoading,
    isLoadingMore,
    hasNext,
    sentinelRef,
    reset
  };
}
