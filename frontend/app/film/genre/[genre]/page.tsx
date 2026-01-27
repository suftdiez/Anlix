'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiHome, FiGrid, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
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

// Film genres from LK21
const FILM_GENRES = [
  'action', 'adventure', 'animation', 'biography', 'comedy', 'crime',
  'documentary', 'drama', 'family', 'fantasy', 'history', 'horror',
  'music', 'mystery', 'romance', 'sci-fi', 'sport', 'thriller', 'war', 'western'
];

export default function FilmGenrePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const genre = params.genre as string;
  const page = parseInt(searchParams.get('page') || '1');

  const [films, setFilms] = useState<FilmItem[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await filmApi.getByGenre(genre, page);
      setFilms(result.data || []);
      setHasNext(result.hasNext || false);
    } catch (err) {
      console.error('Failed to fetch films by genre:', err);
      setError('Gagal memuat film. Silakan coba lagi.');
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
        <Link href="/film" className="hover:text-white transition-colors">
          Film
        </Link>
        <span>/</span>
        <Link href="/film/genre" className="hover:text-white transition-colors">
          Genre
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
          Film {formatGenreName(genre)}
        </h1>
      </motion.div>

      {/* Genre Tags */}
      <div className="mb-8 overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max">
          {FILM_GENRES.slice(0, 12).map((g) => (
            <Link
              key={g}
              href={`/film/genre/${g}`}
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
            href="/film/genre"
            className="px-3 py-1.5 text-sm rounded-full bg-dark-card border border-white/10 text-gray-400 hover:text-white hover:border-primary/50 transition-all"
          >
            Lihat Semua...
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Film Grid */}
      {isLoading ? (
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
                href={`/film/genre/${genre}?page=${page - 1}`}
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
                href={`/film/genre/${genre}?page=${page + 1}`}
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
          <p className="text-gray-500">Tidak ada film ditemukan untuk genre ini</p>
        </div>
      )}
    </div>
  );
}
