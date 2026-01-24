'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiHome, FiFilm, FiChevronLeft, FiChevronRight, FiList, FiAlertCircle } from 'react-icons/fi';
import { dramaboxApi, dramaboxSansekaiApi } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Get full video URL - proxy external videos to bypass CORS
function getVideoUrl(videoPath: string, source: string = 'dramabox'): string {
  if (!videoPath) return '';
  
  // If it starts with http, we need to proxy it through our backend for CORS
  if (videoPath.startsWith('http')) {
    // Use video proxy for external URLs (DramaBox CDN, etc.)
    return `${API_URL}/api/drama/video?url=${encodeURIComponent(videoPath)}`;
  }
  
  // Already a relative proxy URL from backend
  return `${API_URL}${videoPath}`;
}

interface Episode {
  id: string;
  index: number;
  name: string;
  videoUrl: string;
  quality: number;
}

export default function DramaBoxWatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const epNum = parseInt(searchParams?.get('ep') || '1');
  const dramaTitle = searchParams?.get('title') || 'Drama';
  const source = searchParams?.get('source') || 'dramabox';

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEpisodeList, setShowEpisodeList] = useState(false);

  // Use the appropriate API based on source
  const api = source === 'dramabox-sansekai' ? dramaboxSansekaiApi : dramaboxApi;

  useEffect(() => {
    const fetchEpisodes = async () => {
      if (!id) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch episodes only (detail API doesn't work)
        const epResult = await api.getEpisodes(id);
        const eps = epResult.data || [];
        
        if (eps.length === 0) {
          setError('Episode tidak tersedia untuk drama ini.');
          setIsLoading(false);
          return;
        }
        
        setEpisodes(eps);

        // Find current episode by index (1-indexed from URL)
        const currentEp = eps.find((e: Episode) => e.index === epNum);
        if (currentEp) {
          setCurrentEpisode(currentEp);
        } else if (eps.length > 0) {
          // Fallback to first episode
          setCurrentEpisode(eps[0]);
        }
      } catch (err) {
        console.error('Failed to fetch episodes:', err);
        setError('Gagal memuat episode. Silakan coba lagi.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEpisodes();
  }, [id, epNum, api]);

  // Debug logging
  useEffect(() => {
    if (currentEpisode) {
      console.log('Current Episode:', currentEpisode);
      console.log('Video URL:', currentEpisode.videoUrl);
    }
  }, [currentEpisode]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-dark-card rounded w-64 mb-4" />
          <div className="aspect-[9/16] md:aspect-video max-w-4xl mx-auto bg-dark-card rounded-xl flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4" />
              <p className="text-gray-400">Memuat video... (bisa memakan waktu 30-60 detik)</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto aspect-[9/16] md:aspect-video bg-dark-card rounded-xl flex items-center justify-center">
          <div className="text-center">
            <FiAlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-400">{error}</p>
            <Link href={`/drama/dramabox/${id}`} className="text-pink-400 hover:underline mt-2 inline-block">
              Kembali ke Detail
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const prevEp = episodes.find(e => e.index === epNum - 1);
  const nextEp = episodes.find(e => e.index === epNum + 1);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-4 flex-wrap">
        <Link href="/" className="hover:text-white transition-colors">
          <FiHome className="w-4 h-4" />
        </Link>
        <FiChevronRight className="w-3 h-3" />
        <Link href="/drama" className="hover:text-white transition-colors">
          Drama
        </Link>
        <FiChevronRight className="w-3 h-3" />
        <Link href={`/drama/dramabox/${id}`} className="hover:text-white transition-colors line-clamp-1">
          Detail
        </Link>
        <FiChevronRight className="w-3 h-3" />
        <span className="text-pink-400">Episode {currentEpisode?.index || epNum}</span>
      </nav>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl md:text-2xl font-bold text-white mb-4 flex items-center gap-2"
      >
        <FiFilm className="w-5 h-5 text-pink-400" />
        {decodeURIComponent(dramaTitle)} - Episode {currentEpisode?.index || epNum}
      </motion.h1>

      {/* Video Player */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center mb-6"
      >
        {currentEpisode?.videoUrl ? (
          <div className="relative w-full max-w-sm md:max-w-md bg-black rounded-xl overflow-hidden">
            {/* Fixed aspect ratio for vertical drama videos (9:16) */}
            <div className="relative" style={{ paddingBottom: '177.78%' }}>
              <video
                key={currentEpisode.videoUrl}
                src={getVideoUrl(currentEpisode.videoUrl)}
                controls
                autoPlay
                className="absolute inset-0 w-full h-full object-contain"
                playsInline
              >
                Your browser does not support the video tag.
              </video>
              {/* Quality badge */}
              <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded z-10">
                {currentEpisode.quality}p
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-sm aspect-[9/16] bg-dark-card rounded-xl flex items-center justify-center">
            <div className="text-center">
              <FiAlertCircle className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500">Video tidak tersedia untuk episode ini.</p>
              <p className="text-gray-600 text-sm mt-1">Episode: {currentEpisode?.index || epNum}</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Episode Navigation */}
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 mb-6">
        {prevEp ? (
          <Link
            href={`/drama/dramabox/${id}/watch?ep=${prevEp.index}&title=${encodeURIComponent(dramaTitle)}`}
            className="flex items-center gap-2 px-4 py-2 bg-dark-card hover:bg-pink-500/20 border border-white/10 rounded-lg text-white transition-colors"
          >
            <FiChevronLeft className="w-4 h-4" />
            Ep {prevEp.index}
          </Link>
        ) : (
          <div />
        )}

        <button
          onClick={() => setShowEpisodeList(!showEpisodeList)}
          className="flex items-center gap-2 px-4 py-2 bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/50 rounded-lg text-pink-400 transition-colors"
        >
          <FiList className="w-4 h-4" />
          Episode ({episodes.length})
        </button>

        {nextEp ? (
          <Link
            href={`/drama/dramabox/${id}/watch?ep=${nextEp.index}&title=${encodeURIComponent(dramaTitle)}`}
            className="flex items-center gap-2 px-4 py-2 bg-dark-card hover:bg-pink-500/20 border border-white/10 rounded-lg text-white transition-colors"
          >
            Ep {nextEp.index}
            <FiChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <div />
        )}
      </div>

      {/* Episode List */}
      {showEpisodeList && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="max-w-4xl mx-auto bg-dark-card rounded-xl p-4 mb-6"
        >
          <h3 className="text-white font-medium mb-3">Pilih Episode</h3>
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-64 overflow-y-auto">
            {episodes.map((ep) => (
              <Link
                key={ep.id}
                href={`/drama/dramabox/${id}/watch?ep=${ep.index}&title=${encodeURIComponent(dramaTitle)}`}
                className={`flex items-center justify-center px-2 py-2 rounded text-sm transition-all ${
                  ep.index === currentEpisode?.index
                    ? 'bg-pink-500 text-white'
                    : ep.videoUrl
                    ? 'bg-dark-bg hover:bg-pink-500/20 text-gray-300 hover:text-white'
                    : 'bg-dark-bg text-gray-600 cursor-not-allowed'
                }`}
              >
                {ep.index}
              </Link>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
