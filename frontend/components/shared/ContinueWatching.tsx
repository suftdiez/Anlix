'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiPlay, FiClock, FiChevronRight } from 'react-icons/fi';
import { userApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface WatchHistoryItem {
  _id: string;
  contentId: string;
  contentType: 'anime' | 'donghua' | 'film';
  episodeId: string;
  episodeNumber: number;
  title: string;
  episodeTitle: string;
  poster: string;
  slug: string;
  progress: number;
  watchedAt: string;
}

interface ContinueWatchingProps {
  contentType?: 'anime' | 'donghua' | 'film';
  maxItems?: number;
}

export default function ContinueWatching({ contentType, maxItems = 6 }: ContinueWatchingProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }

      try {
        // Get incomplete watches (progress < 90%)
        const response = await userApi.getHistory(1, maxItems, contentType, true);
        if (response.success) {
          setHistory(response.data || []);
        }
      } catch (error) {
        console.error('Error fetching watch history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) {
      fetchHistory();
    }
  }, [isAuthenticated, authLoading, contentType, maxItems]);

  // Don't render if not authenticated or no history
  if (authLoading || !isAuthenticated || (!isLoading && history.length === 0)) {
    return null;
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="mb-8">
        <div className="h-6 bg-gray-800 rounded w-40 mb-4 animate-pulse" />
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-56 animate-pulse">
              <div className="aspect-video bg-gray-800 rounded-lg mb-2" />
              <div className="h-4 bg-gray-800 rounded w-3/4 mb-1" />
              <div className="h-3 bg-gray-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Get watch link based on content type
  const getWatchLink = (item: WatchHistoryItem) => {
    if (item.contentType === 'anime') {
      return `/anime/${item.slug}/${item.episodeId}`;
    } else if (item.contentType === 'donghua') {
      return `/donghua/${item.slug}/${item.episodeId}`;
    } else {
      return `/film/${item.slug}`;
    }
  };

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FiPlay className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-white">Lanjut Nonton</h2>
        </div>
        <Link
          href="/profil?tab=history"
          className="text-sm text-gray-400 hover:text-primary flex items-center gap-1 transition"
        >
          Lihat Semua
          <FiChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Horizontal scroll container */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
        {history.map((item) => (
          <Link
            key={item._id}
            href={getWatchLink(item)}
            className="flex-shrink-0 w-52 sm:w-64 group"
          >
            {/* Card */}
            <div className="relative bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all">
              {/* Thumbnail */}
              <div className="aspect-video relative overflow-hidden">
                <Image
                  src={item.poster || '/placeholder-video.jpg'}
                  alt={item.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 208px, 256px"
                  unoptimized
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                
                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                  <div 
                    className="h-full bg-primary transition-all"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
                
                {/* Episode badge (only for anime/donghua) */}
                <div className="absolute bottom-2 left-2">
                  <span className="text-white text-xs bg-black/70 px-2 py-1 rounded">
                    {item.contentType === 'film' ? 'Film' : `Episode ${item.episodeNumber}`}
                  </span>
                </div>
                
                {/* Play icon overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center">
                    <FiPlay className="w-6 h-6 text-white ml-1" />
                  </div>
                </div>
              </div>
              
              {/* Info */}
              <div className="p-3">
                <h3 className="text-sm font-medium text-white line-clamp-1 group-hover:text-primary transition">
                  {item.title}
                </h3>
                {item.episodeTitle && (
                  <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">
                    {item.episodeTitle}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <FiClock className="w-3 h-3" />
                    <span>{formatTimeAgo(item.watchedAt)}</span>
                  </div>
                  <span className="text-xs text-primary font-medium">
                    {item.progress}% selesai
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// Helper function to format time ago
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 7) return `${diffDays} hari lalu`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu lalu`;
  return `${Math.floor(diffDays / 30)} bulan lalu`;
}
