'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiHome, FiFilm, FiChevronLeft, FiList } from 'react-icons/fi';
import { rebahinApi } from '@/lib/api';

interface EpisodeItem {
  number: string;
  streamUrl: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/** Build a proxied embed URL via our backend embed proxy */
function getProxiedEmbedUrl(streamUrl: string): string {
  const encoded = btoa(streamUrl);
  return `${API_BASE}/api/drama/rebahin/embed?url=${encodeURIComponent(encoded)}`;
}

export default function RebahinWatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const initialEp = parseInt(searchParams.get('ep') || '0');

  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [currentEp, setCurrentEp] = useState(initialEp);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showEpList, setShowEpList] = useState(false);

  // Fetch episodes list
  useEffect(() => {
    const fetchEpisodes = async () => {
      setIsLoading(true);
      try {
        const res = await rebahinApi.getEpisodes(slug);
        if (res.success && res.data?.episodes?.length > 0) {
          setEpisodes(res.data.episodes);
          setTitle(res.data.title || slug.replace(/-/g, ' '));
        }
      } catch (err) {
        console.error('Error fetching episodes:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) fetchEpisodes();
  }, [slug]);

  const currentEpisode = episodes[currentEp];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-dark-card rounded mb-4" />
          <div className="aspect-video bg-dark-card rounded-xl" />
        </div>
      </div>
    );
  }

  if (!currentEpisode) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <FiFilm className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">Episode tidak tersedia</p>
        <Link href={`/drama/rebahin/${slug}`} className="text-teal-400 hover:text-teal-300 mt-4 inline-block">
          ← Kembali ke Detail
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/" className="hover:text-white transition-colors">
          <FiHome className="w-4 h-4" />
        </Link>
        <span>/</span>
        <Link href="/drama" className="hover:text-white transition-colors">Drama</Link>
        <span>/</span>
        <Link href={`/drama/rebahin/${slug}`} className="hover:text-white transition-colors truncate max-w-[150px]">
          {title}
        </Link>
        <span>/</span>
        <span className="text-teal-400">{currentEpisode.number}</span>
      </nav>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl md:text-2xl font-bold text-white mb-4"
      >
        {title} — {currentEpisode.number}
      </motion.h1>

      {/* Player (embed proxy iframe) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-white/10 mb-6"
      >
        <iframe
          src={getProxiedEmbedUrl(currentEpisode.streamUrl)}
          className="absolute inset-0 w-full h-full"
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </motion.div>

      {/* Episode navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setCurrentEp(Math.max(0, currentEp - 1))}
          disabled={currentEp === 0}
          className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-white/5 rounded-lg text-sm text-gray-300 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <FiChevronLeft className="w-4 h-4" />
          Sebelumnya
        </button>

        <button
          onClick={() => setShowEpList(!showEpList)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500/20 border border-teal-500/30 rounded-lg text-sm text-teal-400 hover:text-teal-300 transition-all"
        >
          <FiList className="w-4 h-4" />
          {currentEpisode.number} / {episodes.length} Episode
        </button>

        <button
          onClick={() => setCurrentEp(Math.min(episodes.length - 1, currentEp + 1))}
          disabled={currentEp >= episodes.length - 1}
          className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-white/5 rounded-lg text-sm text-gray-300 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Selanjutnya
          <FiChevronLeft className="w-4 h-4 rotate-180" />
        </button>
      </div>

      {/* Episode Grid */}
      {showEpList && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-6"
        >
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 p-4 bg-dark-card/50 rounded-xl border border-white/5">
            {episodes.map((ep, i) => (
              <button
                key={i}
                onClick={() => { setCurrentEp(i); setShowEpList(false); }}
                className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                  i === currentEp
                    ? 'bg-teal-500 text-white'
                    : 'bg-dark-card border border-white/5 text-gray-400 hover:text-white hover:border-teal-500/50'
                }`}
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
