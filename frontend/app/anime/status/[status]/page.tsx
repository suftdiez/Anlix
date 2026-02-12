'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiHome, FiPlay, FiCheckCircle, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { animeApi } from '@/lib/api';
import AnimeCard from '@/components/ui/AnimeCard';
import { CardSkeleton } from '@/components/ui/Skeletons';

interface AnimeItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  type?: string;
  rating?: string;
  latestEpisode?: string;
  status?: string;
}

export default function AnimeStatusPage() {
  const params = useParams();
  const status = params.status as string; // 'ongoing' or 'completed'
  
  const [animes, setAnimes] = useState<AnimeItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOngoing = status === 'ongoing';
  const statusLabel = isOngoing ? 'Ongoing' : 'Completed';
  const StatusIcon = isOngoing ? FiPlay : FiCheckCircle;
  const statusColor = isOngoing ? 'green' : 'blue';

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await animeApi.getByStatus(status, page);
        setAnimes(result.data || []);
        setHasNext(result.hasNext || false);
      } catch (err) {
        console.error('Failed to fetch anime by status:', err);
        setError('Gagal memuat data. Silakan coba lagi.');
      } finally {
        setIsLoading(false);
      }
    };

    if (status === 'ongoing' || status === 'completed') {
      fetchData();
    }
  }, [status, page]);

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
        <span className={`text-${statusColor}-400`}>{statusLabel}</span>
      </nav>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-2"
      >
        <StatusIcon className={`w-6 h-6 text-${statusColor}-400`} />
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white">
          Anime {statusLabel}
        </h1>
      </motion.div>
      
      <p className="text-gray-400 mb-8">
        {isOngoing 
          ? 'Daftar anime yang masih tayang dan update setiap minggu' 
          : 'Daftar anime yang sudah selesai tayang'}
      </p>

      {/* Status Toggle */}
      <div className="flex gap-3 mb-8">
        <Link
          href="/anime/status/ongoing"
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            isOngoing
              ? 'bg-green-500/20 border border-green-500/50 text-green-400'
              : 'bg-dark-card border border-white/10 text-gray-400 hover:text-white hover:border-white/30'
          }`}
        >
          <FiPlay className="w-4 h-4" />
          Ongoing
        </Link>
        <Link
          href="/anime/status/completed"
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            !isOngoing
              ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400'
              : 'bg-dark-card border border-white/10 text-gray-400 hover:text-white hover:border-white/30'
          }`}
        >
          <FiCheckCircle className="w-4 h-4" />
          Completed
        </Link>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(18)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : animes.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {animes.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
              >
                <AnimeCard
                  id={item.id}
                  title={item.title}
                  slug={item.slug}
                  poster={item.poster}
                  type={item.type || 'TV'}
                  rating={item.rating}
                  latestEpisode={item.latestEpisode}
                  status={item.status}
                  contentType="anime"
                />
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-4 mt-8">
            {page > 1 && (
              <button
                onClick={() => setPage(p => p - 1)}
                className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-primary/50 transition-all"
              >
                <FiChevronLeft className="w-4 h-4" />
                Sebelumnya
              </button>
            )}
            
            <span className="px-4 py-2 bg-primary/20 border border-primary/30 rounded-lg text-primary font-semibold">
              {page}
            </span>
            
            {hasNext && (
              <button
                onClick={() => setPage(p => p + 1)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-all"
              >
                Selanjutnya
                <FiChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-20">
          <StatusIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">Tidak ada anime {statusLabel.toLowerCase()} ditemukan</p>
        </div>
      )}
    </div>
  );
}
