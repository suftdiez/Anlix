'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiBook, FiTrash2, FiPlay, FiClock, FiImage, FiMonitor } from 'react-icons/fi';
import { userApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import toast from 'react-hot-toast';

interface ReadingHistoryItem {
  _id: string;
  contentType: 'novel' | 'komik';
  contentSlug: string;
  contentTitle: string;
  contentPoster: string;
  chapterSlug: string;
  chapterNumber: string;
  chapterTitle: string;
  readAt: string;
  // Legacy field aliases (for backward compatibility)
  novelSlug?: string;
  novelTitle?: string;
  novelPoster?: string;
}

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

// Unified history item for display
interface UnifiedHistoryItem {
  _id: string;
  type: 'novel' | 'komik' | 'anime' | 'donghua' | 'film';
  title: string;
  poster: string;
  slug: string;
  subtitle: string; // chapter title or episode title
  date: string;
  progress?: number; // only for anime/donghua/film
  detailLink: string;
  continueLink: string;
  source: 'reading' | 'watch';
}

type FilterType = 'all' | 'novel' | 'komik' | 'anime' | 'donghua';

function normalizeReadingItem(item: ReadingHistoryItem): UnifiedHistoryItem {
  const slug = item.contentSlug || item.novelSlug || '';
  const title = item.contentTitle || item.novelTitle || 'Unknown';
  const poster = item.contentPoster || item.novelPoster || '';
  const type = item.contentType || 'novel';
  
  // Get chapter info
  let subtitle = '';
  if (item.chapterTitle) subtitle = item.chapterTitle;
  else if (item.chapterNumber) subtitle = `Chapter ${item.chapterNumber}`;
  else {
    const match = item.chapterSlug?.match(/chapter[- ]?(\d+)/i);
    if (match) subtitle = `Chapter ${match[1]}`;
    else {
      const numMatch = item.chapterSlug?.match(/(\d+)/);
      if (numMatch) subtitle = `Chapter ${numMatch[1]}`;
      else subtitle = item.chapterSlug || 'Unknown Chapter';
    }
  }
  
  const detailLink = type === 'komik' ? `/komik/${slug}` : `/novel/${slug}`;
  const continueLink = type === 'komik' 
    ? `/komik/baca/${item.chapterSlug}` 
    : `/novel/baca/${slug}/${item.chapterSlug}`;

  return {
    _id: item._id,
    type,
    title,
    poster,
    slug,
    subtitle,
    date: item.readAt,
    detailLink,
    continueLink,
    source: 'reading',
  };
}

function normalizeWatchItem(item: WatchHistoryItem): UnifiedHistoryItem {
  const type = item.contentType;
  
  let detailLink = '';
  let continueLink = '';
  if (type === 'anime') {
    detailLink = `/anime/${item.slug}`;
    continueLink = `/anime/${item.slug}/${item.episodeId}`;
  } else if (type === 'donghua') {
    detailLink = `/donghua/${item.slug}`;
    continueLink = `/donghua/${item.slug}/${item.episodeId}`;
  } else {
    detailLink = `/film/${item.slug}`;
    continueLink = `/film/${item.slug}`;
  }
  
  const subtitle = type === 'film' 
    ? (item.episodeTitle || 'Film') 
    : `Episode ${item.episodeNumber}${item.episodeTitle ? ` - ${item.episodeTitle}` : ''}`;

  return {
    _id: item._id,
    type,
    title: item.title,
    poster: item.poster || '',
    slug: item.slug,
    subtitle,
    date: item.watchedAt,
    progress: item.progress,
    detailLink,
    continueLink,
    source: 'watch',
  };
}

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'Semua',
  anime: 'Anime',
  donghua: 'Donghua',
  novel: 'Novel',
  komik: 'Komik',
};

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  anime: { label: 'Anime', color: 'bg-red-600' },
  donghua: { label: 'Donghua', color: 'bg-orange-600' },
  novel: { label: 'Novel', color: 'bg-blue-600' },
  komik: { label: 'Komik', color: 'bg-green-600' },
  film: { label: 'Film', color: 'bg-purple-600' },
};

export default function ReadingHistoryPage() {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<UnifiedHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    const fetchHistory = async () => {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const isWatchFilter = filter === 'anime' || filter === 'donghua';
        const isReadFilter = filter === 'novel' || filter === 'komik';

        if (isWatchFilter) {
          // Only fetch watch history for anime/donghua
          const response = await userApi.getHistory(page, 20, filter as 'anime' | 'donghua');
          if (response.success) {
            const unified = (response.data || []).map(normalizeWatchItem);
            setItems(unified);
            setTotalPages(response.totalPages || 1);
          }
        } else if (isReadFilter) {
          // Only fetch reading history for novel/komik
          const response = await userApi.getReadingHistory(page, 20, filter as 'novel' | 'komik');
          if (response.success) {
            const unified = (response.data || []).map(normalizeReadingItem);
            setItems(unified);
            setTotalPages(response.totalPages || 1);
          }
        } else {
          // Fetch both reading and watch history, then combine and sort
          const [readingRes, watchRes] = await Promise.all([
            userApi.getReadingHistory(1, 50).catch(() => ({ success: false, data: [] })),
            userApi.getHistory(1, 50).catch(() => ({ success: false, data: [] })),
          ]);
          
          const readingItems = readingRes.success 
            ? (readingRes.data || []).map(normalizeReadingItem) 
            : [];
          const watchItems = watchRes.success 
            ? (watchRes.data || []).map(normalizeWatchItem) 
            : [];
          
          // Combine and sort by date (most recent first)
          const combined = [...readingItems, ...watchItems].sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          
          // Client-side pagination for combined view
          const perPage = 20;
          const totalItems = combined.length;
          setTotalPages(Math.ceil(totalItems / perPage) || 1);
          setItems(combined.slice((page - 1) * perPage, page * perPage));
        }
      } catch (error) {
        console.error('Error fetching history:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [isAuthenticated, page, filter]);

  const handleRemove = async (item: UnifiedHistoryItem) => {
    try {
      if (item.source === 'reading') {
        await userApi.removeReadingHistory(item._id);
      } else {
        await userApi.removeHistory(item._id);
      }
      setItems(prev => prev.filter(h => h._id !== item._id));
      toast.success('Riwayat dihapus');
    } catch (error) {
      toast.error('Gagal menghapus riwayat');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Hapus semua riwayat?')) return;
    try {
      const isWatchFilter = filter === 'anime' || filter === 'donghua';
      const isReadFilter = filter === 'novel' || filter === 'komik';
      
      if (isWatchFilter || filter === 'all') {
        await userApi.clearHistory().catch(() => {});
      }
      if (isReadFilter || filter === 'all') {
        const readType = filter === 'all' ? undefined : (filter as 'novel' | 'komik');
        await userApi.clearReadingHistory(readType).catch(() => {});
      }
      setItems([]);
      toast.success('Riwayat dihapus');
    } catch (error) {
      toast.error('Gagal menghapus riwayat');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (mins < 1) return 'Baru saja';
    if (mins < 60) return `${mins} menit lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    if (days === 1) return 'Kemarin';
    if (days < 7) return `${days} hari lalu`;
    return date.toLocaleDateString('id-ID');
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <FiBook className="w-16 h-16 mx-auto text-gray-600 mb-4" />
        <h2 className="text-xl text-white mb-2">Silakan Login</h2>
        <p className="text-gray-400 mb-4">Anda perlu login untuk melihat riwayat</p>
        <Link href="/auth/login" className="text-primary hover:underline">
          Login Sekarang
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <FiClock className="w-8 h-8 text-primary" />
            Riwayat
          </h1>
          <p className="text-gray-400 mt-2">
            Lanjutkan nonton dan baca dari terakhir kamu berhenti
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={handleClearAll}
            className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition"
          >
            Hapus Semua
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(Object.keys(FILTER_LABELS) as FilterType[]).map((type) => (
          <button
            key={type}
            onClick={() => { setFilter(type); setPage(1); }}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === type 
                ? 'bg-primary text-white' 
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {FILTER_LABELS[type]}
          </button>
        ))}
      </div>

      {/* History List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse flex gap-4 p-4 bg-gray-900 rounded-lg">
              <div className="w-16 h-24 bg-gray-800 rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-gray-800 rounded w-3/4" />
                <div className="h-4 bg-gray-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={`${item.source}-${item._id}`}
              className="group flex gap-4 p-4 bg-gray-900 rounded-lg hover:bg-gray-800/80 transition"
            >
              {/* Poster */}
              <Link href={item.detailLink} className="flex-shrink-0">
                <div className="relative w-16 h-24 rounded overflow-hidden bg-gray-800">
                  {item.poster ? (
                    <Image
                      src={item.poster}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="64px"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FiImage className="w-6 h-6 text-gray-600" />
                    </div>
                  )}
                  {/* Type Badge */}
                  <span className={`absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-medium rounded text-white ${
                    TYPE_BADGES[item.type]?.color || 'bg-gray-600'
                  }`}>
                    {TYPE_BADGES[item.type]?.label || item.type}
                  </span>
                  
                  {/* Progress bar for anime/donghua */}
                  {item.progress !== undefined && item.progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                      <div 
                        className="h-full bg-primary"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </Link>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <Link href={item.detailLink}>
                  <h3 className="font-medium text-white line-clamp-1 hover:text-primary transition">
                    {item.title}
                  </h3>
                </Link>
                <p className="text-sm text-gray-400 mt-1">
                  {item.subtitle}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-xs text-gray-500">
                    {formatDate(item.date)}
                  </p>
                  {item.progress !== undefined && (
                    <span className="text-xs text-primary font-medium">
                      {item.progress}% selesai
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Link
                  href={item.continueLink}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition text-sm"
                >
                  {item.source === 'watch' ? (
                    <FiMonitor className="w-4 h-4" />
                  ) : (
                    <FiPlay className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">Lanjutkan</span>
                </Link>
                <button
                  onClick={() => handleRemove(item)}
                  className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-900/20 rounded-lg transition opacity-0 group-hover:opacity-100"
                  title="Hapus"
                >
                  <FiTrash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <FiBook className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">
            {filter === 'all' 
              ? 'Belum ada riwayat. Mulai nonton anime atau baca novel/komik!' 
              : `Belum ada riwayat ${FILTER_LABELS[filter]}.`}
          </p>
          <div className="flex justify-center gap-4 mt-4">
            <Link href="/anime" className="text-red-400 hover:underline">
              Jelajahi Anime
            </Link>
            <Link href="/novel" className="text-primary hover:underline">
              Jelajahi Novel
            </Link>
            <Link href="/komik" className="text-green-400 hover:underline">
              Jelajahi Komik
            </Link>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-4 mt-8">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-6 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition"
          >
            Sebelumnya
          </button>
          <span className="px-4 py-2 text-white">Halaman {page} dari {totalPages}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages}
            className="px-6 py-2 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/80 transition"
          >
            Selanjutnya
          </button>
        </div>
      )}
    </div>
  );
}
