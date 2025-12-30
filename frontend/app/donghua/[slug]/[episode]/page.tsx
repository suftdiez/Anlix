'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiChevronLeft, FiChevronRight, FiHome, FiList } from 'react-icons/fi';
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
  const slug = params.slug as string;
  const episode = params.episode as string;
  const { isAuthenticated } = useAuth();

  const [data, setData] = useState<EpisodeDetail | null>(null);
  const [selectedServer, setSelectedServer] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await donghuaApi.getEpisode(episode);
        setData(result.data);

        if (isAuthenticated && result.data) {
          try {
            await userApi.addHistory({
              contentId: slug,
              contentType: 'donghua',
              episodeId: episode,
              episodeNumber: parseInt(result.data.episodeNumber) || 1,
              title: result.data.donghuaTitle,
              episodeTitle: result.data.title,
              slug: slug,
              progress: 0,
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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="skeleton h-8 w-64 mb-4" />
          <div className="skeleton aspect-video w-full rounded-xl mb-4" />
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
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/" className="hover:text-white transition-colors"><FiHome className="w-4 h-4" /></Link>
        <span>/</span>
        <Link href="/donghua" className="hover:text-white transition-colors">Donghua</Link>
        <span>/</span>
        <Link href={`/donghua/${slug}`} className="hover:text-white transition-colors">{data.donghuaTitle}</Link>
        <span>/</span>
        <span className="text-accent">Episode {data.episodeNumber}</span>
      </nav>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl md:text-2xl font-display font-bold text-white mb-6"
      >
        {data.title}
      </motion.h1>

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

      {data.servers.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Pilih Server:</h3>
          <div className="flex flex-wrap gap-2">
            {data.servers.map((server, index) => (
              <button
                key={index}
                onClick={() => setSelectedServer(index)}
                className={`px-4 py-2 text-sm rounded-lg transition-all ${
                  selectedServer === index
                    ? 'bg-accent text-dark'
                    : 'bg-dark-card border border-white/10 text-gray-300 hover:border-accent/50'
                }`}
              >
                {server.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 p-4 bg-dark-card rounded-xl border border-white/5">
        {data.prevEpisode ? (
          <Link href={`/donghua/${slug}/${data.prevEpisode}`} className="flex items-center gap-2 text-gray-300 hover:text-white">
            <FiChevronLeft className="w-5 h-5" /><span className="hidden sm:inline">Prev</span>
          </Link>
        ) : <div />}

        <Link href={`/donghua/${slug}`} className="flex items-center gap-2 px-4 py-2 bg-dark-200 rounded-lg text-gray-300 hover:text-white">
          <FiList className="w-5 h-5" /><span className="hidden sm:inline">Daftar Episode</span>
        </Link>

        {data.nextEpisode ? (
          <Link href={`/donghua/${slug}/${data.nextEpisode}`} className="flex items-center gap-2 text-gray-300 hover:text-white">
            <span className="hidden sm:inline">Next</span><FiChevronRight className="w-5 h-5" />
          </Link>
        ) : <div />}
      </div>
    </div>
  );
}
