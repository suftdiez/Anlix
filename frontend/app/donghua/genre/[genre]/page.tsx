'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiHome, FiGrid, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { donghuaApi } from '@/lib/api';
import AnimeCard from '@/components/ui/AnimeCard';
import { CardSkeleton } from '@/components/ui/Skeletons';

interface DonghuaItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  type?: string;
  status?: string;
  rating?: string;
  latestEpisode?: string;
}

// Genre list from Anichin
const DONGHUA_GENRES = [
  'action', 'adventure', 'comedy', 'cultivation', 'demons', 'drama', 
  'ecchi', 'fantasy', 'friendship', 'game', 'gore', 'gourmet', 'harem', 
  'historical', 'horror', 'isekai', 'life', 'magic', 'martial-arts', 
  'mecha', 'military', 'music', 'mystery', 'mythology', 'psychological', 
  'reincarnation', 'romance', 'school', 'sci-fi', 'shoujo', 'shounen', 
  'slice-of-life', 'space', 'sports', 'super-power', 'supernatural', 
  'suspense', 'thriller', 'urban-fantasy'
];

export default function DonghuaGenrePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const genre = params.genre as string;
  const page = parseInt(searchParams.get('page') || '1');

  const [donghuaList, setDonghuaList] = useState<DonghuaItem[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await donghuaApi.getByGenre(genre, page);
      setDonghuaList(result.data || []);
      setHasNext(result.hasNext || false);
    } catch (error) {
      console.error('Failed to fetch donghua by genre:', error);
    } finally {
      setIsLoading(false);
    }
  }, [genre, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatGenreName = (g: string) => {
    return g.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-white transition-colors">
          <FiHome className="w-4 h-4" />
        </Link>
        <span>/</span>
        <Link href="/donghua" className="hover:text-white transition-colors">
          Donghua
        </Link>
        <span>/</span>
        <span className="text-accent">{formatGenreName(genre)}</span>
      </nav>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-6"
      >
        <FiGrid className="w-6 h-6 text-accent" />
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white">
          Donghua {formatGenreName(genre)}
        </h1>
      </motion.div>

      {/* Genre Tags */}
      <div className="mb-8 overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max">
          {DONGHUA_GENRES.slice(0, 15).map((g) => (
            <Link
              key={g}
              href={`/donghua/genre/${g}`}
              className={`px-3 py-1.5 text-sm rounded-full transition-all whitespace-nowrap ${
                g === genre
                  ? 'bg-accent text-dark'
                  : 'bg-dark-card border border-white/10 text-gray-300 hover:border-accent/50'
              }`}
            >
              {formatGenreName(g)}
            </Link>
          ))}
          <Link
            href="/donghua/genre"
            className="px-3 py-1.5 text-sm rounded-full bg-dark-card border border-white/10 text-gray-400 hover:text-white hover:border-accent/50 transition-all"
          >
            Lihat Semua...
          </Link>
        </div>
      </div>

      {/* Donghua Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : donghuaList.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {donghuaList.map((donghua, index) => (
              <motion.div
                key={donghua.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <AnimeCard
                  id={donghua.id}
                  title={donghua.title}
                  slug={donghua.slug}
                  poster={donghua.poster}
                  type={donghua.type}
                  rating={donghua.rating}
                  latestEpisode={donghua.latestEpisode}
                  contentType="donghua"
                />
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-4 mt-8">
            {page > 1 && (
              <Link
                href={`/donghua/genre/${genre}?page=${page - 1}`}
                className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-accent/50 transition-all"
              >
                <FiChevronLeft className="w-4 h-4" />
                Previous
              </Link>
            )}
            
            <span className="text-gray-400">Page {page}</span>
            
            {hasNext && (
              <Link
                href={`/donghua/genre/${genre}?page=${page + 1}`}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-dark rounded-lg hover:bg-accent/80 transition-all"
              >
                Next
                <FiChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-500">Tidak ada donghua ditemukan untuk genre ini</p>
        </div>
      )}
    </div>
  );
}
