'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { FiSearch, FiBook, FiX } from 'react-icons/fi';
import { novelApi } from '@/lib/api';

interface Novel {
  id: string;
  title: string;
  slug: string;
  poster: string;
  latestChapter?: string;
  type?: string;
}

export default function NovelSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(queryParam);
  const [novels, setNovels] = useState<Novel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const performSearch = useCallback(async (searchQuery: string, currentPage: number) => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setHasSearched(true);
    try {
      const response = await novelApi.search(searchQuery, currentPage);
      if (response.success) {
        setNovels(response.novels);
        setHasNext(response.hasNext);
      }
    } catch (error) {
      console.error('Error searching novels:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Search on initial load if query param exists
  useEffect(() => {
    if (queryParam) {
      setQuery(queryParam);
      performSearch(queryParam, 1);
    }
  }, [queryParam, performSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setPage(1);
      router.push(`/novel/search?q=${encodeURIComponent(query)}`);
      performSearch(query, 1);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    performSearch(query, newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          Cari <span className="gradient-text">Novel</span>
        </h1>
        <p className="text-gray-400 mb-4">
          Temukan novel favoritmu dari ribuan koleksi
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative max-w-2xl">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik judul novel..."
            className="w-full px-5 py-4 pr-24 bg-gray-900 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-16 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-white transition"
            >
              <FiX className="w-5 h-5" />
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 disabled:opacity-50 transition"
          >
            <FiSearch className="w-5 h-5" />
          </button>
        </div>
      </form>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] bg-gray-800 rounded-lg mb-2" />
              <div className="h-4 bg-gray-800 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : novels.length > 0 ? (
        <>
          <p className="text-gray-400 mb-4">
            Menampilkan hasil untuk &quot;<span className="text-white">{queryParam}</span>&quot;
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {novels.map((novel) => (
              <Link
                key={novel.id}
                href={`/novel/${novel.slug}`}
                className="group relative bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all"
              >
                <div className="aspect-[3/4] relative overflow-hidden">
                  <Image
                    src={novel.poster || '/placeholder-novel.jpg'}
                    alt={novel.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                  />
                  {novel.type && (
                    <span className={`absolute top-2 left-2 px-2 py-0.5 text-white text-xs font-medium rounded ${
                      novel.type === 'HTL' ? 'bg-green-600' : 'bg-blue-600'
                    }`}>
                      {novel.type}
                    </span>
                  )}
                  {novel.latestChapter && (
                    <span className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent text-white text-xs">
                      {novel.latestChapter}
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-primary transition">
                    {novel.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {(hasNext || page > 1) && (
            <div className="flex justify-center gap-4 mt-8">
              <button
                onClick={() => handlePageChange(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-6 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition"
              >
                Sebelumnya
              </button>
              <span className="px-4 py-2 text-white">Halaman {page}</span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={!hasNext}
                className="px-6 py-2 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/80 transition"
              >
                Selanjutnya
              </button>
            </div>
          )}
        </>
      ) : hasSearched ? (
        <div className="text-center py-12">
          <FiBook className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <h3 className="text-xl text-white mb-2">Tidak ada hasil</h3>
          <p className="text-gray-400">Coba kata kunci lain atau periksa ejaannya</p>
        </div>
      ) : (
        <div className="text-center py-12">
          <FiSearch className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <h3 className="text-xl text-white mb-2">Mulai Pencarian</h3>
          <p className="text-gray-400">Ketik judul novel yang ingin kamu cari</p>
        </div>
      )}

      {/* Back to Novel */}
      <div className="mt-8 text-center">
        <Link
          href="/novel"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition"
        >
          <FiBook className="w-4 h-4" />
          Kembali ke Daftar Novel
        </Link>
      </div>
    </div>
  );
}
