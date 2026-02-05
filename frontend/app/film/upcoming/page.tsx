'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { filmApi } from '@/lib/api';
import { FiArrowLeft, FiCalendar, FiStar } from 'react-icons/fi';

interface UpcomingMovie {
  id: string;
  title: string;
  slug: string;
  poster: string;
  backdrop: string;
  releaseDate: string;
  overview: string;
  rating: string;
  voteCount: number;
  language: string;
}

export default function UpcomingFilmsPage() {
  const [movies, setMovies] = useState<UpcomingMovie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    const fetchUpcoming = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await filmApi.getUpcoming(page);
        if (response.success) {
          setMovies(response.data);
          setHasNext(response.hasNext);
          setTotalPages(response.totalPages || 0);
        } else {
          setError('Gagal memuat data film');
        }
      } catch (err) {
        console.error('Error fetching upcoming films:', err);
        setError('Tidak dapat terhubung ke server');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUpcoming();
  }, [page]);

  // Format date to Indonesian
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'TBA';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Calculate days until release
  const getDaysUntil = (dateStr: string) => {
    if (!dateStr) return null;
    const release = new Date(dateStr);
    const today = new Date();
    const diff = Math.ceil((release.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href="/film" 
          className="inline-flex items-center gap-2 text-gray-400 hover:text-primary mb-4 transition-colors"
        >
          <FiArrowLeft className="w-4 h-4" />
          Kembali ke Daftar Film
        </Link>
        
        <div className="flex items-center gap-4 mb-2">
          <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl">
            <FiCalendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-white">
              Film Coming Soon
            </h1>
            <p className="text-gray-400 text-sm">
              Film yang akan segera tayang di bioskop
            </p>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video bg-gray-800 rounded-xl mb-3" />
              <div className="h-4 bg-gray-800 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-20">
          <p className="text-red-400 mb-4">{error}</p>
          <p className="text-gray-500 text-sm mb-4">
            Pastikan TMDB_API_KEY sudah dikonfigurasi di backend
          </p>
          <button
            onClick={() => setPage(1)}
            className="btn-primary"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Movies Grid */}
      {!isLoading && !error && (
        <>
          {movies.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400">Tidak ada data film coming soon</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {movies.map((movie) => {
                const daysUntil = getDaysUntil(movie.releaseDate);
                
                return (
                  <div
                    key={movie.id}
                    className="group bg-dark-card rounded-xl overflow-hidden border border-white/5 hover:border-primary/50 transition-all"
                  >
                    {/* Backdrop/Poster */}
                    <div className="aspect-video relative overflow-hidden">
                      {movie.backdrop || movie.poster ? (
                        <Image
                          src={movie.backdrop || movie.poster}
                          alt={movie.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500">
                          No Image
                        </div>
                      )}
                      
                      {/* Days until badge */}
                      {daysUntil !== null && (
                        <div className="absolute top-3 right-3">
                          {daysUntil <= 0 ? (
                            <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded">
                              TAYANG
                            </span>
                          ) : daysUntil <= 7 ? (
                            <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">
                              {daysUntil} HARI LAGI
                            </span>
                          ) : daysUntil <= 30 ? (
                            <span className="px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded">
                              {daysUntil} HARI
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-700 text-white text-xs font-bold rounded">
                              {Math.ceil(daysUntil / 30)} BULAN
                            </span>
                          )}
                        </div>
                      )}

                      {/* Rating badge */}
                      {movie.rating && parseFloat(movie.rating) > 0 && (
                        <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 bg-black/70 rounded text-xs">
                          <FiStar className="w-3 h-3 text-yellow-400" />
                          <span className="text-white">{movie.rating}</span>
                        </div>
                      )}

                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-dark-card via-transparent to-transparent" />
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-white text-lg mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                        {movie.title}
                      </h3>
                      
                      <div className="flex items-center gap-3 text-sm text-gray-400 mb-3">
                        <span className="flex items-center gap-1">
                          <FiCalendar className="w-3 h-3" />
                          {formatDate(movie.releaseDate)}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">
                          {movie.language}
                        </span>
                      </div>

                      <p className="text-gray-500 text-sm line-clamp-2">
                        {movie.overview || 'Tidak ada sinopsis.'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {movies.length > 0 && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sebelumnya
              </button>
              
              <span className="text-gray-400">
                Halaman {page} {totalPages > 0 && `dari ${totalPages}`}
              </span>
              
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={!hasNext}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Selanjutnya
              </button>
            </div>
          )}
        </>
      )}

    </div>
  );
}
