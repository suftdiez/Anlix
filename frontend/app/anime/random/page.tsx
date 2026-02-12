'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiHome, FiShuffle, FiRefreshCw } from 'react-icons/fi';
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

export default function AnimeRandomPage() {
  const router = useRouter();
  const [animes, setAnimes] = useState<AnimeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRandom = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get random page from 1-10 and pick random items
      const randomPage = Math.floor(Math.random() * 10) + 1;
      const result = await animeApi.getLatest(randomPage);
      const allItems = result.data || [];
      
      // Shuffle and pick 12 random items
      const shuffled = allItems.sort(() => Math.random() - 0.5);
      setAnimes(shuffled.slice(0, 12));
    } catch (err) {
      console.error('Failed to fetch random anime:', err);
      setError('Gagal memuat data. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRandom();
  }, []);

  const handleShuffle = () => {
    fetchRandom();
  };

  const handleSurpriseMe = () => {
    if (animes.length > 0) {
      const randomItem = animes[Math.floor(Math.random() * animes.length)];
      router.push(`/anime/${randomItem.slug}`);
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
        <Link href="/anime" className="hover:text-white transition-colors">
          Anime
        </Link>
        <span>/</span>
        <span className="text-purple-400">Random</span>
      </nav>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-2"
      >
        <FiShuffle className="w-6 h-6 text-purple-400" />
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white">
          Random Anime
        </h1>
      </motion.div>
      
      <p className="text-gray-400 mb-6">
        Bingung mau nonton apa? Biarkan kami pilihkan untukmu!
      </p>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={handleShuffle}
          disabled={isLoading}
          className="flex items-center gap-2 px-6 py-3 bg-purple-500/20 border border-purple-500/50 rounded-xl text-purple-400 hover:bg-purple-500/30 hover:text-purple-300 transition-all disabled:opacity-50"
        >
          <FiRefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          Shuffle Lagi
        </button>
        <button
          onClick={handleSurpriseMe}
          disabled={isLoading || animes.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-semibold hover:opacity-90 transition-all disabled:opacity-50"
        >
          <FiShuffle className="w-5 h-5" />
          Surprise Me!
        </button>
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
          {[...Array(12)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : animes.length > 0 ? (
        <motion.div 
          key={animes[0]?.id} // Re-animate on shuffle
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
        >
          {animes.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
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
        </motion.div>
      ) : (
        <div className="text-center py-20">
          <FiShuffle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">Tidak ada anime ditemukan</p>
        </div>
      )}
    </div>
  );
}
