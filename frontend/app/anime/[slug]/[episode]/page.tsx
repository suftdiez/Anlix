'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiChevronLeft, FiChevronRight, FiHome, FiList, FiMessageCircle, FiRefreshCw } from 'react-icons/fi';
import { animeApi, userApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import toast from 'react-hot-toast';

interface StreamServer {
  name: string;
  url: string;
  quality?: string;
  // For AJAX-based servers (Samehadaku)
  post?: string;
  nume?: string;
  type?: string;
}

interface EpisodeDetail {
  title: string;
  animeTitle: string;
  episodeNumber: string;
  servers: StreamServer[];
  prevEpisode?: string;
  nextEpisode?: string;
  postId?: string;
}

export default function EpisodePage() {
  const params = useParams();
  const slug = params.slug as string;
  const episode = params.episode as string;
  const { isAuthenticated } = useAuth();

  const [data, setData] = useState<EpisodeDetail | null>(null);
  const [selectedServer, setSelectedServer] = useState(0);
  const [currentStreamUrl, setCurrentStreamUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingServer, setIsLoadingServer] = useState(false);

  // Fetch stream URL for AJAX-based servers
  const fetchServerStream = useCallback(async (server: StreamServer) => {
    if (!server.post || !server.nume) {
      // Not an AJAX-based server, use URL directly
      setCurrentStreamUrl(server.url || '');
      return;
    }

    setIsLoadingServer(true);
    try {
      const result = await animeApi.getServerStream(server.post, server.nume, server.type || 'video');
      if (result.success && result.data?.url) {
        setCurrentStreamUrl(result.data.url);
      } else {
        toast.error('Gagal memuat server ini');
        setCurrentStreamUrl('');
      }
    } catch (error) {
      console.error('Failed to fetch server stream:', error);
      toast.error('Gagal memuat server');
      setCurrentStreamUrl('');
    } finally {
      setIsLoadingServer(false);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await animeApi.getEpisode(episode);
        setData(result.data);

        // Set initial stream URL
        if (result.data?.servers?.length > 0) {
          const firstServer = result.data.servers[0];
          if (firstServer.url) {
            setCurrentStreamUrl(firstServer.url);
          } else if (firstServer.post && firstServer.nume) {
            // AJAX-based server, fetch stream URL
            await fetchServerStream(firstServer);
          }
        }

        // Save to history
        if (isAuthenticated && result.data) {
          try {
            await userApi.addHistory({
              contentId: slug,
              contentType: 'anime',
              episodeId: episode,
              episodeNumber: parseInt(result.data.episodeNumber) || 1,
              title: result.data.animeTitle,
              episodeTitle: result.data.title,
              slug: slug,
              progress: 0,
            });
          } catch (e) {
            // Ignore errors
          }
        }
      } catch (error) {
        console.error('Failed to fetch episode:', error);
        toast.error('Gagal memuat episode');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [episode, slug, isAuthenticated, fetchServerStream]);

  // Handle server selection
  const handleServerChange = async (index: number) => {
    if (!data) return;
    
    setSelectedServer(index);
    const server = data.servers[index];
    
    if (server.url) {
      // Direct URL available
      setCurrentStreamUrl(server.url);
    } else if (server.post && server.nume) {
      // AJAX-based server, need to fetch stream URL
      await fetchServerStream(server);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="skeleton h-8 w-64 mb-4" />
          <div className="skeleton aspect-video w-full rounded-xl mb-4" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-10 w-24 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl text-gray-400">Episode tidak ditemukan</h1>
      </div>
    );
  }

  const currentServer = data.servers[selectedServer];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/" className="hover:text-white transition-colors">
          <FiHome className="w-4 h-4" />
        </Link>
        <span>/</span>
        <Link href="/anime" className="hover:text-white transition-colors">
          Anime
        </Link>
        <span>/</span>
        <Link href={`/anime/${slug}`} className="hover:text-white transition-colors">
          {data.animeTitle}
        </Link>
        <span>/</span>
        <span className="text-primary">Episode {data.episodeNumber}</span>
      </nav>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl md:text-2xl font-display font-bold text-white mb-6"
      >
        {data.title}
      </motion.h1>

      {/* Video Player */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative aspect-video bg-dark-card rounded-xl overflow-hidden border border-white/10 mb-4"
      >
        {isLoadingServer ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <FiRefreshCw className="w-8 h-8 animate-spin mr-2" />
            <span>Memuat server...</span>
          </div>
        ) : currentStreamUrl ? (
          <iframe
            src={currentStreamUrl}
            className="w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Tidak ada server tersedia
          </div>
        )}
      </motion.div>

      {/* Server Selection */}
      {data.servers.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            Pilih Server ({data.servers.length} tersedia):
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.servers.map((server, index) => (
              <button
                key={index}
                onClick={() => handleServerChange(index)}
                disabled={isLoadingServer}
                className={`px-4 py-2 text-sm rounded-lg transition-all ${
                  selectedServer === index
                    ? 'bg-primary text-white'
                    : 'bg-dark-card border border-white/10 text-gray-300 hover:border-primary/50'
                } ${isLoadingServer ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {server.name}
                {server.quality && (
                  <span className="ml-1 text-xs opacity-70">({server.quality})</span>
                )}
                {/* Show indicator for AJAX-based servers */}
                {server.post && server.nume && !server.url && (
                  <span className="ml-1 text-xs text-yellow-400">•</span>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Tip: Jika server tidak berfungsi, coba pilih server lain.
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4 p-4 bg-dark-card rounded-xl border border-white/5">
        {data.prevEpisode ? (
          <Link
            href={`/anime/${slug}/${data.prevEpisode}`}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
          >
            <FiChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Episode Sebelumnya</span>
            <span className="sm:hidden">Prev</span>
          </Link>
        ) : (
          <div />
        )}

        <Link
          href={`/anime/${slug}`}
          className="flex items-center gap-2 px-4 py-2 bg-dark-200 rounded-lg text-gray-300 hover:text-white transition-colors"
        >
          <FiList className="w-5 h-5" />
          <span className="hidden sm:inline">Daftar Episode</span>
        </Link>

        {data.nextEpisode ? (
          <Link
            href={`/anime/${slug}/${data.nextEpisode}`}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
          >
            <span className="hidden sm:inline">Episode Selanjutnya</span>
            <span className="sm:hidden">Next</span>
            <FiChevronRight className="w-5 h-5" />
          </Link>
        ) : (
          <div />
        )}
      </div>

      {/* Comments Section Placeholder */}
      <div className="mt-8 p-6 bg-dark-card rounded-xl border border-white/5">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
          <FiMessageCircle className="w-5 h-5 text-primary" />
          Komentar
        </h3>
        <p className="text-gray-500 text-center py-8">
          Login untuk menambahkan komentar
        </p>
      </div>
    </div>
  );
}
