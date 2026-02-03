'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiBook, FiTrash2, FiPlay, FiClock, FiImage } from 'react-icons/fi';
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

type FilterType = 'all' | 'novel' | 'komik';

export default function ReadingHistoryPage() {
  const { isAuthenticated } = useAuth();
  const [history, setHistory] = useState<ReadingHistoryItem[]>([]);
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
        // Fetch based on filter
        const type = filter === 'all' ? undefined : filter;
        const response = await userApi.getReadingHistory(page, 20, type);
        if (response.success) {
          setHistory(response.data);
          setTotalPages(response.totalPages);
        }
      } catch (error) {
        console.error('Error fetching reading history:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [isAuthenticated, page, filter]);

  const handleRemove = async (id: string) => {
    try {
      await userApi.removeReadingHistory(id);
      setHistory(prev => prev.filter(h => h._id !== id));
      toast.success('Riwayat dihapus');
    } catch (error) {
      toast.error('Gagal menghapus riwayat');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Hapus semua riwayat baca?')) return;
    try {
      const type = filter === 'all' ? undefined : filter;
      await userApi.clearReadingHistory(type);
      setHistory([]);
      toast.success('Riwayat dihapus');
    } catch (error) {
      toast.error('Gagal menghapus riwayat');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Hari ini';
    if (days === 1) return 'Kemarin';
    if (days < 7) return `${days} hari lalu`;
    return date.toLocaleDateString('id-ID');
  };

  // Helper to get correct field values (handle both old and new schema)
  const getSlug = (item: ReadingHistoryItem) => item.contentSlug || item.novelSlug || '';
  const getTitle = (item: ReadingHistoryItem) => item.contentTitle || item.novelTitle || 'Unknown';
  const getPoster = (item: ReadingHistoryItem) => item.contentPoster || item.novelPoster || '';
  const getType = (item: ReadingHistoryItem) => item.contentType || 'novel';

  // Get link based on content type
  const getDetailLink = (item: ReadingHistoryItem) => {
    const slug = getSlug(item);
    const type = getType(item);
    return type === 'komik' ? `/komik/${slug}` : `/novel/${slug}`;
  };

  const getReadLink = (item: ReadingHistoryItem) => {
    const slug = getSlug(item);
    const type = getType(item);
    return type === 'komik' 
      ? `/komik/baca/${item.chapterSlug}` 
      : `/novel/baca/${slug}/${item.chapterSlug}`;
  };

  // Get chapter info with fallback to extracting from chapterSlug
  const getChapterInfo = (item: ReadingHistoryItem) => {
    if (item.chapterTitle) return item.chapterTitle;
    if (item.chapterNumber) return `Chapter ${item.chapterNumber}`;
    
    // Try to extract chapter number from chapterSlug
    const match = item.chapterSlug?.match(/chapter[- ]?(\d+)/i);
    if (match) return `Chapter ${match[1]}`;
    
    // Try to extract any number from the slug
    const numMatch = item.chapterSlug?.match(/(\d+)/);
    if (numMatch) return `Chapter ${numMatch[1]}`;
    
    return item.chapterSlug || 'Unknown Chapter';
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <FiBook className="w-16 h-16 mx-auto text-gray-600 mb-4" />
        <h2 className="text-xl text-white mb-2">Silakan Login</h2>
        <p className="text-gray-400 mb-4">Anda perlu login untuk melihat riwayat baca</p>
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
            Riwayat Baca
          </h1>
          <p className="text-gray-400 mt-2">
            Lanjutkan membaca dari terakhir kamu berhenti
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition"
          >
            Hapus Semua
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'novel', 'komik'] as FilterType[]).map((type) => (
          <button
            key={type}
            onClick={() => { setFilter(type); setPage(1); }}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === type 
                ? 'bg-primary text-white' 
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {type === 'all' ? 'Semua' : type.charAt(0).toUpperCase() + type.slice(1)}
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
      ) : history.length > 0 ? (
        <div className="space-y-3">
          {history.map((item) => (
            <div
              key={item._id}
              className="group flex gap-4 p-4 bg-gray-900 rounded-lg hover:bg-gray-800/80 transition"
            >
              {/* Poster */}
              <Link href={getDetailLink(item)} className="flex-shrink-0">
                <div className="relative w-16 h-24 rounded overflow-hidden bg-gray-800">
                  {getPoster(item) ? (
                    <Image
                      src={getPoster(item)}
                      alt={getTitle(item)}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FiImage className="w-6 h-6 text-gray-600" />
                    </div>
                  )}
                  {/* Type Badge */}
                  <span className={`absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${
                    getType(item) === 'komik' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
                  }`}>
                    {getType(item) === 'komik' ? 'Komik' : 'Novel'}
                  </span>
                </div>
              </Link>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <Link href={getDetailLink(item)}>
                  <h3 className="font-medium text-white line-clamp-1 hover:text-primary transition">
                    {getTitle(item)}
                  </h3>
                </Link>
                <p className="text-sm text-gray-400 mt-1">
                  {getChapterInfo(item)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDate(item.readAt)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Link
                  href={getReadLink(item)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition text-sm"
                >
                  <FiPlay className="w-4 h-4" />
                  <span className="hidden sm:inline">Lanjutkan</span>
                </Link>
                <button
                  onClick={() => handleRemove(item._id)}
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
              ? 'Belum ada riwayat baca. Mulai baca novel atau komik!' 
              : `Belum ada riwayat baca ${filter}.`}
          </p>
          <div className="flex justify-center gap-4 mt-4">
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
