'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FiHome, FiFilm, FiPlay, FiStar, FiClock, FiChevronRight } from 'react-icons/fi';
import { dramaboxApi } from '@/lib/api';

interface DramaDetail {
  id: string;
  title: string;
  poster: string;
  abstract: string;
  status: string;
  episodeCount: number;
  categories: string[];
  playCount?: string;
  protagonist?: string;
}

interface Episode {
  id: string;
  index: number;
  name: string;
  videoUrl: string;
  quality: number;
}

export default function DramaBoxDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  
  // Get drama data from URL params (passed from listing page)
  const title = searchParams?.get('title') || '';
  const poster = searchParams?.get('poster') || '';
  const abstract = searchParams?.get('abstract') || '';
  const episodeCount = parseInt(searchParams?.get('eps') || '0');
  
  const [drama, setDrama] = useState<DramaDetail | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      
      setIsLoading(true);
      
      // Use URL params first, then try API
      if (title && poster) {
        setDrama({
          id,
          title: decodeURIComponent(title),
          poster: decodeURIComponent(poster),
          abstract: abstract ? decodeURIComponent(abstract) : '',
          status: 'Unknown',
          episodeCount,
          categories: [],
        });
        setIsLoading(false);
      } else {
        // Fallback: try to get from API
        try {
          const result = await dramaboxApi.getDetail(id);
          if (result.data) {
            setDrama(result.data);
          }
        } catch (error) {
          console.error('Failed to fetch drama detail:', error);
        } finally {
          setIsLoading(false);
        }
      }

      // Fetch episodes
      setIsLoadingEpisodes(true);
      try {
        const epResult = await dramaboxApi.getEpisodes(id);
        setEpisodes(epResult.data || []);
      } catch (error) {
        console.error('Failed to fetch episodes:', error);
      } finally {
        setIsLoadingEpisodes(false);
      }
    };

    fetchData();
  }, [id, title, poster, abstract, episodeCount]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-dark-card rounded w-64 mb-8" />
          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-64 aspect-[2/3] bg-dark-card rounded-xl" />
            <div className="flex-1 space-y-4">
              <div className="h-8 bg-dark-card rounded w-3/4" />
              <div className="h-4 bg-dark-card rounded w-1/2" />
              <div className="h-32 bg-dark-card rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!drama) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <FiFilm className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h1 className="text-xl text-white mb-2">Drama Tidak Ditemukan</h1>
        <p className="text-gray-500 mb-4">Silakan kembali ke halaman drama dan pilih drama dari daftar.</p>
        <Link href="/drama" className="text-pink-400 hover:underline">
          Kembali ke Drama
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6 flex-wrap">
        <Link href="/" className="hover:text-white transition-colors">
          <FiHome className="w-4 h-4" />
        </Link>
        <FiChevronRight className="w-3 h-3" />
        <Link href="/drama" className="hover:text-white transition-colors">
          Drama
        </Link>
        <FiChevronRight className="w-3 h-3" />
        <span className="text-pink-400 line-clamp-1">{drama.title}</span>
      </nav>

      {/* Drama Info */}
      <div className="flex flex-col md:flex-row gap-8 mb-12">
        {/* Poster */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full md:w-64 flex-shrink-0"
        >
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden">
            <Image
              src={drama.poster}
              alt={drama.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        </motion.div>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1"
        >
          <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-4">
            {drama.title}
          </h1>

          <div className="flex flex-wrap gap-3 mb-4">
            {drama.playCount && (
              <div className="flex items-center gap-1 px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm">
                <FiStar className="w-4 h-4" />
                {drama.playCount} views
              </div>
            )}
            <div className="flex items-center gap-1 px-3 py-1 bg-pink-500/20 text-pink-400 rounded-lg text-sm">
              <FiFilm className="w-4 h-4" />
              {drama.episodeCount} Episode
            </div>
          </div>

          {drama.protagonist && (
            <p className="text-gray-400 text-sm mb-2">
              <span className="text-gray-500">Pemeran:</span> {drama.protagonist}
            </p>
          )}

          {drama.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {drama.categories.map((cat, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-dark-card text-gray-400 rounded text-xs"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}

          <p className="text-gray-400 leading-relaxed mb-6">
            {drama.abstract || 'Deskripsi tidak tersedia.'}
          </p>

          {episodes.length > 0 && (
            <Link
              href={`/drama/dramabox/${id}/watch?ep=1&title=${encodeURIComponent(drama.title)}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors"
            >
              <FiPlay className="w-5 h-5" />
              Tonton Episode 1
            </Link>
          )}
        </motion.div>
      </div>

      {/* Episodes */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <FiClock className="w-5 h-5 text-pink-400" />
          Daftar Episode
        </h2>

        {isLoadingEpisodes ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto mb-4" />
            <p className="text-gray-500">Memuat episode... (bisa memakan waktu 30-60 detik)</p>
          </div>
        ) : episodes.length > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {episodes.map((ep) => (
              <Link
                key={ep.id}
                href={`/drama/dramabox/${id}/watch?ep=${ep.index}`}
                className="flex items-center justify-center px-3 py-2 bg-dark-card hover:bg-pink-500/20 border border-white/5 hover:border-pink-500/50 rounded-lg text-sm text-gray-300 hover:text-white transition-all"
              >
                {ep.index}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            Episode tidak tersedia atau masih dimuat. Coba refresh halaman.
          </p>
        )}
      </div>
    </div>
  );
}
