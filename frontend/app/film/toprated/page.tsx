'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiChevronLeft, FiStar, FiTrendingUp } from 'react-icons/fi';
import { AnimeCard, Pagination, CardGridSkeleton } from '@/components';
import { filmApi } from '@/lib/api';

interface FilmItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  year?: string;
  rating?: string;
  quality?: string;
}

export default function TopRatedFilmsPage() {
  const [films, setFilms] = useState<FilmItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFilms = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await filmApi.getTopRated(page);
        setFilms(data.data || []);
        setHasNext(data.hasNext || false);
      } catch (err) {
        console.error('Failed to fetch top rated films:', err);
        setError('Gagal memuat data film');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFilms();
  }, [page]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/film"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition mb-4"
        >
          <FiChevronLeft className="w-4 h-4" />
          Kembali ke Daftar Film
        </Link>
        
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
            <FiStar className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white">
              Film <span className="text-yellow-500">Rating Tertinggi</span>
            </h1>
            <p className="text-gray-400">
              Koleksi film dengan rating terbaik subtitle Indonesia
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full">
            <FiTrendingUp className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-yellow-500">Diurutkan berdasarkan rating</span>
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
      {isLoading ? (
        <CardGridSkeleton count={18} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {films.map((item, index) => (
              <AnimeCard
                key={`${item.slug}-${index}`}
                id={item.id}
                title={item.title}
                slug={item.slug}
                poster={item.poster}
                rating={item.rating}
                type={item.quality || 'HD'}
                contentType="film"
                index={index}
              />
            ))}
          </div>

          {films.length === 0 && !isLoading && !error && (
            <div className="text-center py-20 text-gray-500">
              Tidak ada film ditemukan
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
