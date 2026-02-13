'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FiHome, FiFilm, FiPlay, FiCalendar, FiMapPin, FiUser, FiTag } from 'react-icons/fi';
import { rebahinApi } from '@/lib/api';

interface DramaDetail {
  title: string;
  poster: string;
  synopsis: string;
  genres: string[];
  actors: string[];
  directors: string[];
  country: string;
  releaseDate: string;
  duration: string;
  quality: string;
  episodeInfo?: string;
}

interface EpisodeItem {
  number: string;
  streamUrl: string;
}

export default function RebahinDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [detail, setDetail] = useState<DramaDetail | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [detailRes, episodesRes] = await Promise.all([
          rebahinApi.getDetail(slug),
          rebahinApi.getEpisodes(slug),
        ]);

        if (detailRes.success && detailRes.data) {
          setDetail(detailRes.data);
        } else {
          setError('Drama tidak ditemukan');
        }

        if (episodesRes.success && episodesRes.data?.episodes) {
          setEpisodes(episodesRes.data.episodes);
        }
      } catch (err) {
        console.error('Error fetching drama:', err);
        setError('Gagal memuat data drama');
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) fetchData();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-dark-card rounded" />
          <div className="flex gap-6">
            <div className="w-64 aspect-[2/3] bg-dark-card rounded-xl" />
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

  if (error || !detail) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <FiFilm className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">{error || 'Drama tidak ditemukan'}</p>
        <Link href="/drama" className="text-teal-400 hover:text-teal-300 mt-4 inline-block">
          ← Kembali ke Drama
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
        <Link href="/drama" className="hover:text-white transition-colors">Drama</Link>
        <span>/</span>
        <span className="text-teal-400 truncate max-w-[200px]">{detail.title}</span>
      </nav>

      {/* Hero Section */}
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Poster */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full md:w-64 flex-shrink-0"
        >
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/10">
            {detail.poster ? (
              <Image
                src={detail.poster}
                alt={detail.title}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-teal-900/50 to-blue-900/50 flex items-center justify-center">
                <FiFilm className="w-16 h-16 text-teal-500/50" />
              </div>
            )}
            <div className="absolute top-2 left-2 px-2 py-1 bg-teal-500/90 text-white text-xs rounded-md font-medium">
              Rebahin
            </div>
          </div>
        </motion.div>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1"
        >
          <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-4">
            {detail.title}
          </h1>

          {/* Meta info */}
          <div className="flex flex-wrap gap-3 mb-4">
            {detail.releaseDate && (
              <span className="flex items-center gap-1 text-sm text-gray-400">
                <FiCalendar className="w-4 h-4" /> {detail.releaseDate}
              </span>
            )}
            {detail.country && (
              <span className="flex items-center gap-1 text-sm text-gray-400">
                <FiMapPin className="w-4 h-4" /> {detail.country}
              </span>
            )}
            {detail.duration && (
              <span className="text-sm text-gray-400">{detail.duration}</span>
            )}
            {detail.quality && (
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded font-medium">
                {detail.quality}
              </span>
            )}
            {detail.episodeInfo && (
              <span className="px-2 py-0.5 bg-teal-500/20 text-teal-400 text-xs rounded font-medium">
                {detail.episodeInfo}
              </span>
            )}
          </div>

          {/* Genres */}
          {detail.genres.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <FiTag className="w-4 h-4 text-gray-500" />
              {detail.genres.map((g, i) => (
                <span key={i} className="px-2 py-1 bg-dark-card text-xs text-gray-300 rounded-md border border-white/5">
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Synopsis */}
          {detail.synopsis && (
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              {detail.synopsis}
            </p>
          )}

          {/* Actors */}
          {detail.actors.length > 0 && (
            <div className="mb-3">
              <span className="text-sm text-gray-500 flex items-center gap-1 mb-1">
                <FiUser className="w-3 h-3" /> Pemeran:
              </span>
              <p className="text-sm text-gray-400">{detail.actors.join(', ')}</p>
            </div>
          )}

          {/* Directors */}
          {detail.directors.length > 0 && (
            <div className="mb-4">
              <span className="text-sm text-gray-500">Sutradara: </span>
              <span className="text-sm text-gray-400">{detail.directors.join(', ')}</span>
            </div>
          )}

          {/* Watch button */}
          {episodes.length > 0 && (
            <button
              onClick={() => router.push(`/drama/rebahin/${slug}/watch`)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white rounded-lg transition-all font-medium"
            >
              <FiPlay className="w-5 h-5" />
              Tonton Sekarang ({episodes.length} Episode)
            </button>
          )}
        </motion.div>
      </div>

      {/* Episode List */}
      {episodes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <FiPlay className="w-5 h-5 text-teal-400" />
            Daftar Episode ({episodes.length})
          </h2>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {episodes.map((ep, i) => (
              <button
                key={i}
                onClick={() => router.push(`/drama/rebahin/${slug}/watch?ep=${i}`)}
                className="px-3 py-2 bg-dark-card border border-white/5 hover:border-teal-500/50 rounded-lg text-sm text-gray-300 hover:text-white transition-all text-center"
              >
                {ep.number}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
