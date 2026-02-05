'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiChevronLeft, FiChevronRight, FiHome, FiList, FiMessageCircle } from 'react-icons/fi';
import { donghuaApi, userApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import toast from 'react-hot-toast';

interface StreamServer {
  name: string;
  url: string;
  quality?: string;
}

interface EpisodeDetail {
  title: string;
  donghuaTitle: string;
  episodeNumber: string;
  servers: StreamServer[];
  prevEpisode?: string;
  nextEpisode?: string;
}

export default function DonghuaEpisodePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const episode = params.episode as string;
  const { isAuthenticated } = useAuth();

  const [data, setData] = useState<EpisodeDetail | null>(null);
  const [selectedServer, setSelectedServer] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Refs for tracking progress
  const progressRef = useRef(10);
  const episodeDataRef = useRef<{ title: string; episodeNumber: number; poster: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch episode and detail in parallel
        const [episodeResult, detailResult] = await Promise.all([
          donghuaApi.getEpisode(episode),
          donghuaApi.getDetail(slug).catch(() => ({ data: null })), // Get poster from detail
        ]);
        
        setData(episodeResult.data);
        const poster = detailResult.data?.poster || '';

        // Store for progress updates
        if (episodeResult.data) {
          episodeDataRef.current = {
            title: episodeResult.data.donghuaTitle,
            episodeNumber: parseInt(episodeResult.data.episodeNumber) || 1,
            poster,
          };
        }

        // Save to history with poster (mark as started)
        if (isAuthenticated && episodeResult.data) {
          try {
            await userApi.addHistory({
              contentId: slug,
              contentType: 'donghua',
              episodeId: episode,
              episodeNumber: parseInt(episodeResult.data.episodeNumber) || 1,
              title: episodeResult.data.donghuaTitle,
              episodeTitle: episodeResult.data.title,
              poster: poster,
              slug: slug,
              progress: 10, // Mark as started
            });
          } catch (e) {}
        }
      } catch (error) {
        console.error('Failed to fetch episode:', error);
        toast.error('Gagal memuat episode');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [episode, slug, isAuthenticated]);

  // Time-based progress tracking (since iframes don't allow video event access)
  useEffect(() => {
    if (!isAuthenticated || !data || !episodeDataRef.current) return;

    // Update progress every 2 minutes
    const progressInterval = setInterval(async () => {
      // Increase progress by ~15% every 2 minutes (up to 80%)
      if (progressRef.current < 80) {
        progressRef.current = Math.min(80, progressRef.current + 15);
        
        try {
          await userApi.addHistory({
            contentId: slug,
            contentType: 'donghua',
            episodeId: episode,
            episodeNumber: episodeDataRef.current?.episodeNumber || 1,
            title: episodeDataRef.current?.title || '',
            episodeTitle: data.title,
            poster: episodeDataRef.current?.poster || '',
            slug: slug,
            progress: progressRef.current,
          });
        } catch (e) {
          // Ignore errors
        }
      }
    }, 2 * 60 * 1000); // 2 minutes

    return () => clearInterval(progressInterval);
  }, [isAuthenticated, data, slug, episode]);

  // Handle navigation to next episode - mark current as mostly complete
  const handleNextEpisode = async () => {
    if (!data?.nextEpisode) return;

    // Mark current episode as 90% complete before navigating
    if (isAuthenticated && episodeDataRef.current) {
      try {
        await userApi.addHistory({
          contentId: slug,
          contentType: 'donghua',
          episodeId: episode,
          episodeNumber: episodeDataRef.current.episodeNumber,
          title: episodeDataRef.current.title,
          episodeTitle: data.title,
          poster: episodeDataRef.current.poster,
          slug: slug,
          progress: 90,
        });
      } catch (e) {
        // Ignore errors, still navigate
      }
    }

    router.push(`/donghua/${slug}/${data.nextEpisode}`);
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
        <Link href="/donghua" className="hover:text-white transition-colors">
          Donghua
        </Link>
        <span>/</span>
        <Link href={`/donghua/${slug}`} className="hover:text-white transition-colors">
          {data.donghuaTitle}
        </Link>
        <span>/</span>
        <span className="text-accent">Episode {data.episodeNumber}</span>
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
        {currentServer?.url ? (
          <iframe
            src={currentServer.url}
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
                onClick={() => setSelectedServer(index)}
                className={`px-4 py-2 text-sm rounded-lg transition-all ${
                  selectedServer === index
                    ? 'bg-accent text-dark font-medium'
                    : 'bg-dark-card border border-white/10 text-gray-300 hover:border-accent/50'
                }`}
              >
                {server.name}
                {server.quality && (
                  <span className="ml-1 text-xs opacity-70">({server.quality})</span>
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
            href={`/donghua/${slug}/${data.prevEpisode}`}
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
          href={`/donghua/${slug}`}
          className="flex items-center gap-2 px-4 py-2 bg-dark-200 rounded-lg text-gray-300 hover:text-white transition-colors"
        >
          <FiList className="w-5 h-5" />
          <span className="hidden sm:inline">Daftar Episode</span>
        </Link>

        {data.nextEpisode ? (
          <button
            onClick={handleNextEpisode}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
          >
            <span className="hidden sm:inline">Episode Selanjutnya</span>
            <span className="sm:hidden">Next</span>
            <FiChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <div />
        )}
      </div>

      {/* Comments Section Placeholder */}
      <div className="mt-8 p-6 bg-dark-card rounded-xl border border-white/5">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
          <FiMessageCircle className="w-5 h-5 text-accent" />
          Komentar
        </h3>
        <p className="text-gray-500 text-center py-8">
          Login untuk menambahkan komentar
        </p>
      </div>
    </div>
  );
}
