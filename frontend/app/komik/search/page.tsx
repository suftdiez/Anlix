'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiHome, FiSearch, FiBook } from 'react-icons/fi';
import { komikApi } from '@/lib/api';
import { CardSkeleton } from '@/components/ui/Skeletons';
import Image from 'next/image';

interface ComicItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  type?: string;
  latestChapter?: string;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [comics, setComics] = useState<ComicItem[]>([]);
  const [searchInput, setSearchInput] = useState(query);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!query) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const result = await komikApi.search(query);
      setComics(result.data || []);
    } catch (err) {
      console.error('Failed to search komik:', err);
      setError('Gagal melakukan pencarian. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      window.location.href = `/komik/search?q=${encodeURIComponent(searchInput.trim())}`;
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
        <Link href="/komik" className="hover:text-white transition-colors">
          Komik
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
          Cari Komik
        </h1>
      </motion.div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-3 max-w-2xl">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Masukkan judul komik..."
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
          <FiBook className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">Masukkan kata kunci untuk mencari komik</p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : comics.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {comics.map((comic, index) => (
            <motion.div
              key={comic.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Link
                href={`/komik/${comic.slug}`}
                className="block group"
              >
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-dark-card border border-white/5 group-hover:border-primary/30 transition-all">
                  {comic.poster ? (
                    <Image
                      src={comic.poster}
                      alt={comic.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-dark-card">
                      <FiBook className="w-12 h-12 text-gray-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  
                  {/* Type Badge */}
                  {comic.type && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-primary/80 rounded text-xs font-medium text-white">
                      {comic.type}
                    </div>
                  )}
                  
                  {/* Title */}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-primary transition-colors">
                      {comic.title}
                    </h3>
                    {comic.latestChapter && (
                      <p className="text-xs text-gray-400 mt-1">{comic.latestChapter}</p>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-500">Tidak ada komik ditemukan untuk &quot;{query}&quot;</p>
        </div>
      )}
    </div>
  );
}

export default function KomikSearchPage() {
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
