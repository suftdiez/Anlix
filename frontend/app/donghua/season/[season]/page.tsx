'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiHome, FiGrid } from 'react-icons/fi';
import { donghuaApi } from '@/lib/api';
import { getImageUrl } from '@/lib/utils';

interface DonghuaItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  rating?: string;
  status?: string;
}

interface SeasonsData {
  year: string[];
  seasonal: { name: string; slug: string }[];
}

export default function DonghuaSeasonPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const season = params.season as string;
  const pageParam = parseInt(searchParams.get('page') || '1');

  const [items, setItems] = useState<DonghuaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(pageParam);
  const [seasons, setSeasons] = useState<SeasonsData | null>(null);

  // Format season name for display
  const formatSeasonName = (s: string) => {
    if (/^\d{4}$/.test(s)) {
      return `Tahun ${s}`;
    }
    // Format like "winter-2023" to "Winter 2023"
    return s.split('-').map(part => 
      isNaN(Number(part)) ? part.charAt(0).toUpperCase() + part.slice(1) : part
    ).join(' ');
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [result, seasonsResult] = await Promise.all([
          donghuaApi.getBySeason(season, page),
          donghuaApi.getSeasons()
        ]);
        setItems(result.data || []);
        setHasNext(result.hasNext || false);
        setSeasons(seasonsResult.data || { year: [], seasonal: [] });
      } catch (err) {
        console.error('Failed to fetch season data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [season, page]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    router.push(`/donghua/season/${season}?page=${newPage}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-white transition-colors flex items-center gap-1">
          <FiHome className="w-4 h-4" />
          Home
        </Link>
        <span>/</span>
        <Link href="/donghua" className="hover:text-white transition-colors">Donghua</Link>
        <span>/</span>
        <span className="text-primary">{formatSeasonName(season)}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
            <FiCalendar className="w-8 h-8 text-primary" />
            {formatSeasonName(season)}
          </h1>
          <p className="text-gray-400 mt-2">
            Daftar donghua yang rilis pada {formatSeasonName(season).toLowerCase()}
          </p>
        </div>

        {/* Year Quick Filter */}
        {seasons && seasons.year.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {seasons.year.slice(0, 6).map((year) => (
              <Link
                key={year}
                href={`/donghua/season/${year}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  season === year
                    ? 'bg-primary text-white'
                    : 'bg-dark-card border border-white/10 text-gray-400 hover:text-white hover:border-primary/50'
                }`}
              >
                {year}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Seasonal Filters */}
      {seasons && seasons.seasonal.length > 0 && (
        <div className="mb-8 p-4 bg-dark-card rounded-xl border border-white/10">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Filter Musim:</h3>
          <div className="flex flex-wrap gap-2">
            {seasons.seasonal.map((s) => (
              <Link
                key={s.slug}
                href={`/donghua/season/${s.slug}`}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  season === s.slug
                    ? 'bg-accent text-white'
                    : 'bg-dark border border-white/10 text-gray-400 hover:text-white hover:border-accent/50'
                }`}
              >
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(18)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-poster bg-gray-700 rounded-xl mb-2" />
              <div className="h-4 bg-gray-700 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        <>
          {/* Results Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map((item, index) => (
              <motion.div
                key={item.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Link href={`/donghua/${item.slug}`} className="block group">
                  <div className="relative aspect-poster rounded-xl overflow-hidden bg-dark-card border border-white/5 mb-2 group-hover:border-primary/50 transition-all">
                    <Image
                      src={getImageUrl(item.poster)}
                      alt={item.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-dark/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    {/* Status Badge */}
                    {item.status && (
                      <span className={`absolute top-2 left-2 px-2 py-0.5 text-xs font-medium rounded ${
                        item.status.toLowerCase().includes('ongoing')
                          ? 'bg-green-500/80 text-white'
                          : 'bg-blue-500/80 text-white'
                      }`}>
                        {item.status}
                      </span>
                    )}

                    {/* Rating Badge */}
                    {item.rating && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium bg-accent/80 text-white rounded">
                        ★ {item.rating}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium text-gray-300 line-clamp-2 group-hover:text-white transition-colors">
                    {item.title}
                  </h3>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-primary/50 disabled:opacity-50 disabled:pointer-events-none transition-all"
            >
              <FiChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <span className="px-4 py-2 bg-primary/20 border border-primary/50 rounded-lg text-primary font-medium">
              {page}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={!hasNext}
              className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-primary/50 disabled:opacity-50 disabled:pointer-events-none transition-all"
            >
              Next
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-20">
          <FiGrid className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-400 mb-2">Tidak ada donghua</h2>
          <p className="text-gray-500">Tidak ditemukan donghua untuk {formatSeasonName(season).toLowerCase()}</p>
        </div>
      )}
    </div>
  );
}
