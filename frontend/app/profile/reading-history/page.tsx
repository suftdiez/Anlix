'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiBook, FiTrash2, FiPlay, FiClock } from 'react-icons/fi';
import { userApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import toast from 'react-hot-toast';

interface ReadingHistoryItem {
  _id: string;
  novelSlug: string;
  novelTitle: string;
  novelPoster: string;
  chapterSlug: string;
  chapterNumber: string;
  chapterTitle: string;
  readAt: string;
}

export default function ReadingHistoryPage() {
  const { isAuthenticated } = useAuth();
  const [history, setHistory] = useState<ReadingHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await userApi.getReadingHistory(page, 20);
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
  }, [isAuthenticated, page]);

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
      await userApi.clearReadingHistory();
      setHistory([]);
      toast.success('Semua riwayat dihapus');
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
            Riwayat Baca Novel
          </h1>
          <p className="text-gray-400 mt-2">
            Novel yang terakhir kamu baca
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
              <Link href={`/novel/${item.novelSlug}`} className="flex-shrink-0">
                <div className="relative w-16 h-24 rounded overflow-hidden">
                  <Image
                    src={item.novelPoster || '/placeholder.jpg'}
                    alt={item.novelTitle}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
              </Link>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <Link href={`/novel/${item.novelSlug}`}>
                  <h3 className="font-medium text-white line-clamp-1 hover:text-primary transition">
                    {item.novelTitle}
                  </h3>
                </Link>
                <p className="text-sm text-gray-400 mt-1">
                  {item.chapterNumber || item.chapterTitle}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDate(item.readAt)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Link
                  href={`/novel/baca/${item.novelSlug}/${item.chapterSlug}`}
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
            Belum ada riwayat baca. Mulai baca novel untuk melihat progress!
          </p>
          <Link href="/novel" className="text-primary hover:underline mt-4 inline-block">
            Jelajahi Novel
          </Link>
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
