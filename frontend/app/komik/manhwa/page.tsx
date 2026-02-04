'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiSearch, FiChevronDown, FiLoader } from 'react-icons/fi';
import { komikApi } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

interface Comic {
  id: string;
  title: string;
  slug: string;
  poster: string;
}

type SortOption = 'update' | 'title-asc' | 'title-desc';

const SORT_OPTIONS = [
  { value: 'update', label: 'Update Terbaru' },
  { value: 'title-asc', label: 'Judul A-Z' },
  { value: 'title-desc', label: 'Judul Z-A' },
] as const;

export default function ManhwaPage() {
  const [sortOption, setSortOption] = useState<SortOption>('update');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const fetchComics = useCallback(async (page: number) => {
    const response = await komikApi.getManhwa(page);
    return {
      success: response.success,
      items: response.comics as Comic[],
      hasNext: response.hasNext
    };
  }, []);

  const { items: comics, isLoading, isLoadingMore, hasNext, sentinelRef } = useInfiniteScroll<Comic>({
    fetchFn: fetchComics
  });

  const sortedComics = useMemo(() => {
    if (sortOption === 'update') return comics;
    const sorted = [...comics];
    if (sortOption === 'title-asc') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'id'));
    } else if (sortOption === 'title-desc') {
      sorted.sort((a, b) => b.title.localeCompare(a.title, 'id'));
    }
    return sorted;
  }, [comics, sortOption]);

  const currentSortLabel = SORT_OPTIONS.find(opt => opt.value === sortOption)?.label || 'Urutkan';

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Manhwa</h1>
        <p className="text-gray-400 mb-4">Koleksi manhwa Korea dengan terjemahan Indonesia</p>
        
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/komik/search"
            className="inline-flex items-center gap-2 px-4 py-2 bg-dark-card border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-primary/50 transition-all"
          >
            <FiSearch className="w-4 h-4" />
            Cari Komik
          </Link>
          
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-dark-card border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-primary/50 transition-all"
            >
              <span className="text-gray-500">Urutkan:</span>
              <span className="text-white">{currentSortLabel}</span>
              <FiChevronDown className={`w-4 h-4 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
            </button>
            
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                <div className="absolute top-full left-0 mt-2 w-48 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSortOption(option.value as SortOption);
                        setShowSortMenu(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                        sortOption === option.value
                          ? 'bg-primary/20 text-primary'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Link href="/komik" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Update
        </Link>
        <Link href="/komik/list" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          List
        </Link>
        <Link href="/komik/manga" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Manga
        </Link>
        <Link href="/komik/manhwa" className="px-4 py-2 bg-primary text-white rounded-lg font-medium">
          Manhwa
        </Link>
        <Link href="/komik/manhua" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Manhua
        </Link>
        <Link href="/komik/genre" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Genre
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(24)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] bg-gray-800 rounded-lg mb-2" />
              <div className="h-4 bg-gray-800 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {sortedComics.map((comic) => (
              <Link
                key={comic.id}
                href={`/komik/${comic.slug}`}
                className="group relative bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all"
              >
                <div className="aspect-[3/4] relative overflow-hidden">
                  <Image
                    src={comic.poster || '/placeholder-comic.jpg'}
                    alt={comic.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                  />
                </div>
                <div className="p-2">
                  <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-primary transition">
                    {comic.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>

          <div ref={sentinelRef} className="py-8 flex justify-center">
            {isLoadingMore && (
              <div className="flex items-center gap-2 text-gray-400">
                <FiLoader className="w-5 h-5 animate-spin" />
                <span>Memuat lebih banyak...</span>
              </div>
            )}
            {!hasNext && comics.length > 0 && (
              <p className="text-gray-500 text-sm">Sudah menampilkan semua manhwa</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
