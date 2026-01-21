'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FiHome, FiFilm, FiPlay, FiClock, FiTag } from 'react-icons/fi';
import { dramaApi } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Helper to get full image URL from proxy path
function getImageUrl(posterPath: string): string {
  if (!posterPath) return '/placeholder.jpg';
  if (posterPath.startsWith('http')) return posterPath;
  return `${API_URL}${posterPath}`;
}

interface DramaEpisode {
  vid: string;
  index: number;
  cover: string;
  duration: number;
}

interface DramaDetail {
  id: string;
  title: string;
  poster: string;
  abstract: string;
  status: string;
  episodeCount: number;
  categories: string[];
  episodes: DramaEpisode[];
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function DramaDetailPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [drama, setDrama] = useState<DramaDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const result = await dramaApi.getDetail(id);
        setDrama(result.data);
      } catch (error) {
        console.error('Failed to fetch drama detail:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchDetail();
  }, [id]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-dark-card rounded mb-8" />
          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-64 aspect-[2/3] bg-dark-card rounded-xl" />
            <div className="flex-1 space-y-4">
              <div className="h-8 w-3/4 bg-dark-card rounded" />
              <div className="h-4 w-full bg-dark-card rounded" />
              <div className="h-4 w-full bg-dark-card rounded" />
              <div className="h-4 w-2/3 bg-dark-card rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!drama) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <FiFilm className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Drama tidak ditemukan</h1>
        <Link href="/drama" className="text-pink-400 hover:underline">
          Kembali ke daftar drama
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-white transition-colors">
          <FiHome className="w-4 h-4" />
        </Link>
        <span>/</span>
        <Link href="/drama" className="hover:text-white transition-colors">
          Drama
        </Link>
        <span>/</span>
        <span className="text-pink-400 line-clamp-1">{drama.title}</span>
      </nav>

      {/* Drama Info */}
      <div className="flex flex-col md:flex-row gap-8 mb-10">
        {/* Poster */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full md:w-64 flex-shrink-0"
        >
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/10">
            <Image
              src={getImageUrl(drama.poster)}
              alt={drama.title}
              fill
              className="object-cover"
              priority
            />
            {/* Status badge */}
            <div className="absolute top-3 left-3 px-3 py-1 bg-pink-500/90 text-white text-sm rounded-lg font-medium">
              {drama.status}
            </div>
          </div>
        </motion.div>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1"
        >
          <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-4">
            {drama.title}
          </h1>

          {/* Meta info */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-dark-card rounded-lg text-sm">
              <FiFilm className="w-4 h-4 text-pink-400" />
              <span className="text-gray-300">{drama.episodeCount} Episode</span>
            </div>
          </div>

          {/* Categories */}
          {drama.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {drama.categories.map((cat, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-pink-500/10 border border-pink-500/30 text-pink-400 text-sm rounded-full"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}

          {/* Synopsis */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <FiTag className="w-4 h-4 text-pink-400" />
              Sinopsis
            </h2>
            <p className="text-gray-400 leading-relaxed">{drama.abstract}</p>
          </div>

          {/* Watch button */}
          {drama.episodes.length > 0 && (
            <Link
              href={`/drama/${drama.id}/${drama.episodes[0].vid}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-xl font-medium transition-colors"
            >
              <FiPlay className="w-5 h-5" />
              Tonton Episode 1
            </Link>
          )}
        </motion.div>
      </div>

      {/* Episode List */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <FiFilm className="w-5 h-5 text-pink-400" />
          Daftar Episode ({drama.episodes.length})
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {drama.episodes.map((ep, index) => (
            <motion.div
              key={ep.vid}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
            >
              <Link href={`/drama/${drama.id}/${ep.vid}`}>
                <div className="group relative rounded-lg overflow-hidden bg-dark-card border border-white/5 hover:border-pink-500/50 transition-all">
                  {/* Thumbnail */}
                  <div className="relative aspect-video">
                    <Image
                      src={getImageUrl(ep.cover)}
                      alt={`Episode ${ep.index}`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                      sizes="(max-width: 640px) 50vw, 20vw"
                    />
                    {/* Duration */}
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-white text-xs rounded">
                      {formatDuration(ep.duration)}
                    </div>
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <FiPlay className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  
                  {/* Episode number */}
                  <div className="p-2 text-center">
                    <span className="text-sm text-gray-300 group-hover:text-pink-400 transition-colors">
                      Episode {ep.index}
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
