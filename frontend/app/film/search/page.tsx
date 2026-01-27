'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiHome, FiSearch, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { filmApi } from '@/lib/api';
import AnimeCard from '@/components/ui/AnimeCard';
import { CardSkeleton } from '@/components/ui/Skeletons';

interface FilmItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  year?: string;
  rating?: string;
  quality?: string;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1');

  const [films, setFilms] = useState<FilmItem[]>([]);
  const [searchInput, setSearchInput] = useState(query);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!query) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const result = await filmApi.search(query, page);
      setFilms(result.data || []);
      setHasNext(result.hasNext || false);
    } catch (err) {
      console.error('Failed to search films:', err);
      setError('Gagal melakukan pencarian. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }, [query, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      window.location.href = `/film/search?q=${encodeURIComponent(searchInput.trim())}`;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-white transition-colors">
          <FiHome className="w-4 h-4" />
        </Link>
        <span>/</span>
        <Link href="/film" className="hover:text-white transition-colors">
          Film
        </Link>
        <span>/</span>
        <span className="text-primary">Pencarian</span>
      </nav>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-6"
      >
        <FiSearch className="w-6 h-6 text-primary" />
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white">
          Cari Film
        </h1>
      </motion.div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-3 max-w-2xl">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Masukkan judul film..."
            className="flex-1 px-4 py-3 bg-dark-card border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-primary/50 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/80 transition-colors flex items-center gap-2"
          >
            <FiSearch className="w-5 h-5" />
            Cari
          </button>
        </div>
      </form>

      {/* Search Query Display */}
      {query && (
        <p className="text-gray-400 mb-6">
          Hasil pencarian untuk: <span className="text-white font-medium">&quot;{query}&quot;</span>
        </p>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Results */}
      {!query ? (
        <div className="text-center py-20">
          <FiSearch className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">Masukkan kata kunci untuk mencari film</p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : films.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {films.map((film, index) => (
              <motion.div
                key={film.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <AnimeCard
                  id={film.id}
                  title={film.title}
                  slug={film.slug}
                  poster={film.poster}
                  type={film.quality || 'HD'}
                  rating={film.rating}
                  contentType="film"
                />
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-4 mt-8">
            {page > 1 && (
              <Link
                href={`/film/search?q=${encodeURIComponent(query)}&page=${page - 1}`}
                className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-primary/50 transition-all"
              >
                <FiChevronLeft className="w-4 h-4" />
                Sebelumnya
              </Link>
            )}
            
            <span className="px-4 py-2 bg-primary/20 border border-primary/30 rounded-lg text-primary font-semibold">
              {page}
            </span>
            
            {hasNext && (
              <Link
                href={`/film/search?q=${encodeURIComponent(query)}&page=${page + 1}`}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-all"
              >
                Selanjutnya
                <FiChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-500">Tidak ada film ditemukan untuk &quot;{query}&quot;</p>
        </div>
      )}
    </div>
  );
}

export default function FilmSearchPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-dark-card rounded w-48 mb-6" />
          <div className="h-12 bg-dark-card rounded max-w-2xl mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
