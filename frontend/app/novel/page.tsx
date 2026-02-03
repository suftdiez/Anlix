'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiSearch, FiBook, FiFilter } from 'react-icons/fi';
import { novelApi } from '@/lib/api';

interface Novel {
  id: string;
  title: string;
  slug: string;
  poster: string;
  latestChapter?: string;
  type?: string;
  updatedAt?: string;
}

type SortOption = 'latest' | 'popular' | 'name-asc' | 'name-desc';

export default function NovelPage() {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('latest');

  useEffect(() => {
    const fetchNovels = async () => {
      setIsLoading(true);
      try {
        // Fetch from different endpoint based on sort option
        let response;
        if (sortBy === 'popular') {
          response = await novelApi.getPopular(page);
        } else {
          response = await novelApi.getLatest(page);
        }
        
        if (response.success) {
          setNovels(response.novels);
          setHasNext(response.hasNext);
        }
      } catch (error) {
        console.error('Error fetching novels:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNovels();
  }, [page, sortBy]);

  // Sort novels based on selected option (for name sorting only, API handles latest/popular)
  const sortedNovels = useMemo(() => {
    const sorted = [...novels];
    switch (sortBy) {
      case 'name-asc':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'name-desc':
        return sorted.sort((a, b) => b.title.localeCompare(a.title));
      case 'latest':
      case 'popular':
      default:
        return sorted; // Keep original order from API
    }
  }, [novels, sortBy]);


  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          Daftar <span className="gradient-text">Novel</span>
        </h1>
        <p className="text-gray-400 mb-4">
          Koleksi light novel dan web novel terlengkap dengan terjemahan Indonesia
        </p>
        
        {/* Search Button */}
        <Link
          href="/novel/search"
          className="inline-flex items-center gap-2 px-4 py-2 bg-dark-card border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-primary/50 transition-all"
        >
          <FiSearch className="w-4 h-4" />
          Cari Novel
        </Link>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link href="/novel" className="px-4 py-2 bg-primary text-white rounded-lg font-medium">
          Terbaru
        </Link>
        <Link href="/novel/popular" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Populer
        </Link>
        <Link href="/novel/china" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          China
        </Link>
        <Link href="/novel/jepang" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Jepang
        </Link>
        <Link href="/novel/korea" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Korea
        </Link>
        <Link href="/novel/tamat" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Tamat
        </Link>
        <Link href="/novel/genre" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Genre
        </Link>
        <Link href="/novel/tag" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Tag
        </Link>
      </div>

      {/* Section Header with Sort */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <FiBook className="w-5 h-5 text-primary" />
          {sortBy === 'popular' ? 'Novel Populer' : 'Novel Terbaru'}
        </h2>
        
        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <FiFilter className="w-4 h-4 text-gray-400" />
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as SortOption);
              setPage(1); // Reset to page 1 when sort changes
            }}
            className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
          >
            <option value="latest">Update Terbaru</option>
            <option value="popular">Popularitas</option>
            <option value="name-asc">Nama (A-Z)</option>
            <option value="name-desc">Nama (Z-A)</option>
          </select>
        </div>
      </div>

      {/* Novels Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(18)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] bg-gray-800 rounded-lg mb-2" />
              <div className="h-4 bg-gray-800 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {sortedNovels.map((novel) => (
            <Link
              key={novel.id}
              href={`/novel/${novel.slug}`}
              className="group relative bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all"
            >
              {/* Poster */}
              <div className="aspect-[3/4] relative overflow-hidden">
                <Image
                  src={novel.poster || '/placeholder-novel.jpg'}
                  alt={novel.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                />
                {/* Type Badge (HTL/MTL) */}
                {novel.type && (
                  <span className={`absolute top-2 left-2 px-2 py-0.5 text-white text-xs font-medium rounded ${
                    novel.type === 'HTL' ? 'bg-green-600' : 'bg-blue-600'
                  }`}>
                    {novel.type}
                  </span>
                )}
                {/* Chapter Badge */}
                {novel.latestChapter && (
                  <span className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent text-white text-xs">
                    {novel.latestChapter}
                  </span>
                )}
              </div>
              {/* Title */}
              <div className="p-2">
                <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-primary transition">
                  {novel.title}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Empty State */}
      {novels.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <FiBook className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">Tidak ada novel ditemukan</p>
        </div>
      )}

      {/* Pagination */}
      {(hasNext || page > 1) && (
        <div className="flex justify-center gap-4 mt-8">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-6 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition"
          >
            Sebelumnya
          </button>
          <span className="px-4 py-2 text-white">Halaman {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!hasNext}
            className="px-6 py-2 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/80 transition"
          >
            Selanjutnya
          </button>
        </div>
      )}
    </div>
  );
}
