'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiHome, FiGrid, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { animeApi } from '@/lib/api';
import AnimeCard from '@/components/ui/AnimeCard';
import { CardSkeleton } from '@/components/ui/Skeletons';

interface AnimeItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  type?: string;
  status?: string;
  rating?: string;
  latestEpisode?: string;
}

// Genre list from Samehadaku
const ANIME_GENRES = [
  'action', 'adventure', 'comedy', 'demons', 'drama', 'ecchi', 'fantasy', 
  'game', 'harem', 'historical', 'horror', 'isekai', 'josei', 'kids', 
  'magic', 'martial-arts', 'mecha', 'military', 'music', 'mystery', 
  'parody', 'police', 'psychological', 'romance', 'samurai', 'school', 
  'sci-fi', 'seinen', 'shoujo', 'shoujo-ai', 'shounen', 'shounen-ai', 
  'slice-of-life', 'space', 'sports', 'super-power', 'supernatural', 
  'thriller', 'vampire'
];

export default function AnimeGenrePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const genre = params.genre as string;
  const page = parseInt(searchParams.get('page') || '1');

  const [animeList, setAnimeList] = useState<AnimeItem[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await animeApi.getByGenre(genre, page);
      setAnimeList(result.data || []);
      setHasNext(result.hasNext || false);
    } catch (error) {
      console.error('Failed to fetch anime by genre:', error);
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
        <Link href="/anime" className="hover:text-white transition-colors">
          Anime
        </Link>
        <span>/</span>
        <span className="text-primary">{formatGenreName(genre)}</span>
      </nav>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-6"
      >
        <FiGrid className="w-6 h-6 text-primary" />
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white">
          Anime {formatGenreName(genre)}
        </h1>
      </motion.div>

      {/* Genre Tags */}
      <div className="mb-8 overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max">
          {ANIME_GENRES.slice(0, 15).map((g) => (
            <Link
              key={g}
              href={`/anime/genre/${g}`}
              className={`px-3 py-1.5 text-sm rounded-full transition-all whitespace-nowrap ${
                g === genre
                  ? 'bg-primary text-white'
                  : 'bg-dark-card border border-white/10 text-gray-300 hover:border-primary/50'
              }`}
            >
              {formatGenreName(g)}
            </Link>
          ))}
          <Link
            href="/anime/genre"
            className="px-3 py-1.5 text-sm rounded-full bg-dark-card border border-white/10 text-gray-400 hover:text-white hover:border-primary/50 transition-all"
          >
            Lihat Semua...
          </Link>
        </div>
      </div>

      {/* Anime Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : animeList.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {animeList.map((anime, index) => (
              <motion.div
                key={anime.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <AnimeCard
                  id={anime.id}
                  title={anime.title}
                  slug={anime.slug}
                  poster={anime.poster}
                  type={anime.type}
                  rating={anime.rating}
                  latestEpisode={anime.latestEpisode}
                  contentType="anime"
                />
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-4 mt-8">
            {page > 1 && (
              <Link
                href={`/anime/genre/${genre}?page=${page - 1}`}
                className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-primary/50 transition-all"
              >
                <FiChevronLeft className="w-4 h-4" />
                Previous
              </Link>
            )}
            
            <span className="text-gray-400">Page {page}</span>
            
            {hasNext && (
              <Link
                href={`/anime/genre/${genre}?page=${page + 1}`}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-all"
              >
                Next
                <FiChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-500">Tidak ada anime ditemukan untuk genre ini</p>
        </div>
      )}
    </div>
  );
}
