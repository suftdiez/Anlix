'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiTv } from 'react-icons/fi';
import { AnimeCard, Pagination, CardGridSkeleton } from '@/components';
import { filmApi } from '@/lib/api';

interface SeriesItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  year?: string;
  rating?: string;
  quality?: string;
}

export default function SeriesListPage() {
  const [allSeries, setAllSeries] = useState<SeriesItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSeries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await filmApi.getFeaturedSeries(page);
      const newItems = (data.data || []) as SeriesItem[];
      
      if (page === 1) {
        setAllSeries(newItems);
      } else {
        setAllSeries(prev => [...prev, ...newItems]);
      }
      
      setHasNext(data.hasNext || false);
    } catch (err) {
      console.error('Failed to fetch series:', err);
      setError('Gagal memuat series. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/film"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <FiArrowLeft className="w-4 h-4" />
          Kembali ke Film
        </Link>
        
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl">
            <FiTv className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white">
              Series <span className="gradient-text">Unggulan</span>
            </h1>
            <p className="text-gray-400 mt-1">
              Koleksi series terbaik dengan subtitle Indonesia
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Content */}
      {isLoading && page === 1 ? (
        <CardGridSkeleton count={18} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {allSeries.map((item, index) => (
              <AnimeCard
                key={`${item.slug}-${index}`}
                id={item.id}
                title={item.title}
                slug={item.slug}
                poster={item.poster}
                rating={item.rating}
                type={item.quality || 'Series'}
                contentType="film"
                index={index}
              />
            ))}
          </div>

          {allSeries.length === 0 && !isLoading && !error && (
            <div className="text-center py-20 text-gray-500">
              Tidak ada series ditemukan
            </div>
          )}

          <Pagination
            currentPage={page}
            hasNext={hasNext}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        </>
      )}
    </div>
  );
}
