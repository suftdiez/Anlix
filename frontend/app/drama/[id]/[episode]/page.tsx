'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiHome, FiFilm, FiChevronLeft, FiChevronRight, FiList, FiLoader } from 'react-icons/fi';
import { dramaApi } from '@/lib/api';

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

export default function DramaEpisodePage() {
  const params = useParams();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const dramaId = params.id as string;
  const episodeVid = params.episode as string;
  
  const [drama, setDrama] = useState<DramaDetail | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStream, setIsLoadingStream] = useState(true);
  const [showEpisodes, setShowEpisodes] = useState(false);

  const currentEpisode = drama?.episodes.find(ep => ep.vid === episodeVid);
  const currentIndex = drama?.episodes.findIndex(ep => ep.vid === episodeVid) ?? -1;
  const prevEpisode = currentIndex > 0 ? drama?.episodes[currentIndex - 1] : null;
  const nextEpisode = currentIndex < (drama?.episodes.length || 0) - 1 ? drama?.episodes[currentIndex + 1] : null;

  useEffect(() => {
    const fetchDrama = async () => {
      try {
        const result = await dramaApi.getDetail(dramaId);
        setDrama(result.data);
      } catch (error) {
        console.error('Failed to fetch drama:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (dramaId) fetchDrama();
  }, [dramaId]);

  useEffect(() => {
    const fetchStream = async () => {
      setIsLoadingStream(true);
      setStreamUrl(null);
      try {
        const result = await dramaApi.getStream(episodeVid);
        if (result.data?.url) {
          setStreamUrl(result.data.url);
        }
      } catch (error) {
        console.error('Failed to fetch stream:', error);
      } finally {
        setIsLoadingStream(false);
      }
    };

    if (episodeVid) fetchStream();
  }, [episodeVid]);

  const handleEpisodeChange = (vid: string) => {
    router.push(`/drama/${dramaId}/${vid}`);
    setShowEpisodes(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <FiLoader className="w-8 h-8 text-pink-400 animate-spin" />
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
    <div className="min-h-screen bg-black">
      {/* Video Player - Portrait optimized */}
      <div className="relative w-full max-w-md mx-auto bg-black">
        {/* Breadcrumb */}
        <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
          <nav className="flex items-center gap-2 text-sm text-gray-300">
            <Link href="/" className="hover:text-white">
              <FiHome className="w-4 h-4" />
            </Link>
            <span>/</span>
            <Link href="/drama" className="hover:text-white">Drama</Link>
            <span>/</span>
            <Link href={`/drama/${dramaId}`} className="hover:text-white line-clamp-1 max-w-[100px]">
              {drama.title}
            </Link>
          </nav>
        </div>

        {/* Video Container - 9:16 aspect ratio */}
        <div className="relative aspect-[9/16] bg-dark-800">
          {isLoadingStream ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <FiLoader className="w-10 h-10 text-pink-400 animate-spin mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Memuat video...</p>
              </div>
            </div>
          ) : streamUrl ? (
            <video
              ref={videoRef}
              src={streamUrl}
              controls
              autoPlay
              className="w-full h-full object-contain"
              playsInline
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <FiFilm className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400">Video tidak tersedia</p>
              </div>
            </div>
          )}
        </div>

        {/* Episode Info */}
        <div className="p-4 bg-dark-800 border-t border-white/10">
          <h1 className="text-lg font-bold text-white mb-1">{drama.title}</h1>
          <p className="text-pink-400 text-sm">Episode {currentEpisode?.index || '?'}</p>
        </div>
      </div>

      {/* Episode Navigation */}
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          {/* Prev Episode */}
          <button
            onClick={() => prevEpisode && handleEpisodeChange(prevEpisode.vid)}
            disabled={!prevEpisode}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              prevEpisode
                ? 'bg-dark-card text-white hover:bg-pink-500/20'
                : 'bg-dark-card/50 text-gray-600 cursor-not-allowed'
            }`}
          >
            <FiChevronLeft className="w-4 h-4" />
            <span className="text-sm">Prev</span>
          </button>

          {/* Episode List Toggle */}
          <button
            onClick={() => setShowEpisodes(!showEpisodes)}
            className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
          >
            <FiList className="w-4 h-4" />
            <span className="text-sm">Episode</span>
          </button>

          {/* Next Episode */}
          <button
            onClick={() => nextEpisode && handleEpisodeChange(nextEpisode.vid)}
            disabled={!nextEpisode}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              nextEpisode
                ? 'bg-dark-card text-white hover:bg-pink-500/20'
                : 'bg-dark-card/50 text-gray-600 cursor-not-allowed'
            }`}
          >
            <span className="text-sm">Next</span>
            <FiChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Episode List Modal */}
      {showEpisodes && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center"
          onClick={() => setShowEpisodes(false)}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            className="w-full max-w-md bg-dark-800 rounded-t-2xl max-h-[60vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/10">
              <h2 className="text-lg font-bold text-white">Pilih Episode</h2>
            </div>
            <div className="overflow-y-auto max-h-[50vh] p-4">
              <div className="grid grid-cols-5 gap-2">
                {drama.episodes.map((ep) => (
                  <button
                    key={ep.vid}
                    onClick={() => handleEpisodeChange(ep.vid)}
                    className={`p-3 rounded-lg text-center transition-colors ${
                      ep.vid === episodeVid
                        ? 'bg-pink-500 text-white'
                        : 'bg-dark-card text-gray-300 hover:bg-pink-500/20'
                    }`}
                  >
                    {ep.index}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
