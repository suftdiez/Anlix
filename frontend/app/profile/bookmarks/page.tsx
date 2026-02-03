'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiBookmark, FiTrash2, FiBook, FiFilm, FiPlayCircle, FiImage } from 'react-icons/fi';
import { userApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import toast from 'react-hot-toast';

interface Bookmark {
  _id: string;
  contentId: string;
  contentType: 'anime' | 'donghua' | 'novel' | 'komik';
  title: string;
  poster: string;
  slug: string;
  addedAt: string;
}

export default function BookmarksPage() {
  const { isAuthenticated } = useAuth();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'anime' | 'donghua' | 'novel' | 'komik'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchBookmarks = async () => {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await userApi.getBookmarks(
          page, 
          20, 
          filter === 'all' ? undefined : filter
        );
        if (response.success) {
          setBookmarks(response.data);
          setTotalPages(response.totalPages);
        }
      } catch (error) {
        console.error('Error fetching bookmarks:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBookmarks();
  }, [isAuthenticated, filter, page]);

  const handleRemove = async (id: string) => {
    try {
      await userApi.removeBookmark(id);
      setBookmarks(prev => prev.filter(b => b._id !== id));
      toast.success('Bookmark dihapus');
    } catch (error) {
      toast.error('Gagal menghapus bookmark');
    }
  };

  const getContentLink = (bookmark: Bookmark) => {
    switch (bookmark.contentType) {
      case 'novel':
        return `/novel/${bookmark.slug}`;
      case 'donghua':
        return `/donghua/${bookmark.slug}`;
      case 'komik':
        return `/komik/${bookmark.slug}`;
      case 'anime':
      default:
        return `/anime/${bookmark.slug}`;
    }
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'novel':
        return <FiBook className="w-4 h-4" />;
      case 'donghua':
        return <FiPlayCircle className="w-4 h-4" />;
      case 'komik':
        return <FiImage className="w-4 h-4" />;
      case 'anime':
      default:
        return <FiFilm className="w-4 h-4" />;
    }
  };

  const getContentColor = (type: string) => {
    switch (type) {
      case 'novel':
        return 'bg-purple-600';
      case 'donghua':
        return 'bg-red-600';
      case 'komik':
        return 'bg-green-600';
      case 'anime':
      default:
        return 'bg-blue-600';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <FiBookmark className="w-16 h-16 mx-auto text-gray-600 mb-4" />
        <h2 className="text-xl text-white mb-2">Silakan Login</h2>
        <p className="text-gray-400 mb-4">Anda perlu login untuk melihat bookmark</p>
        <Link href="/auth/login" className="text-primary hover:underline">
          Login Sekarang
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
          <FiBookmark className="w-8 h-8 text-primary" />
          Bookmark Saya
        </h1>
        <p className="text-gray-400 mt-2">
          Koleksi anime, donghua, komik, dan novel yang telah kamu simpan
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['all', 'anime', 'donghua', 'komik', 'novel'] as const).map((type) => (
          <button
            key={type}
            onClick={() => { setFilter(type); setPage(1); }}
            className={`px-4 py-2 rounded-lg font-medium transition capitalize ${
              filter === type
                ? 'bg-primary text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {type === 'all' ? 'Semua' : type}
          </button>
        ))}
      </div>

      {/* Bookmarks Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] bg-gray-800 rounded-lg mb-2" />
              <div className="h-4 bg-gray-800 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : bookmarks.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {bookmarks.map((bookmark) => (
            <div
              key={bookmark._id}
              className="group relative bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all"
            >
              <Link href={getContentLink(bookmark)}>
                <div className="aspect-[3/4] relative overflow-hidden">
                  <Image
                    src={bookmark.poster || '/placeholder.jpg'}
                    alt={bookmark.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                  />
                  {/* Type Badge */}
                  <span className={`absolute top-2 left-2 px-2 py-0.5 text-white text-xs font-medium rounded flex items-center gap-1 ${getContentColor(bookmark.contentType)}`}>
                    {getContentIcon(bookmark.contentType)}
                    {bookmark.contentType}
                  </span>
                </div>
                <div className="p-2">
                  <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-primary transition">
                    {bookmark.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(bookmark.addedAt).toLocaleDateString('id-ID')}
                  </p>
                </div>
              </Link>
              {/* Remove Button */}
              <button
                onClick={() => handleRemove(bookmark._id)}
                className="absolute top-2 right-2 p-2 bg-black/60 rounded-full text-gray-400 hover:text-red-500 hover:bg-black/80 transition opacity-0 group-hover:opacity-100"
                title="Hapus bookmark"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <FiBookmark className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">
            {filter === 'all' 
              ? 'Belum ada bookmark. Mulai simpan anime, donghua, atau novel favoritmu!' 
              : `Belum ada ${filter} yang di-bookmark`}
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            <Link href="/anime" className="text-primary hover:underline">
              Jelajahi Anime
            </Link>
            <Link href="/donghua" className="text-primary hover:underline">
              Jelajahi Donghua
            </Link>
            <Link href="/komik" className="text-primary hover:underline">
              Jelajahi Komik
            </Link>
            <Link href="/novel" className="text-primary hover:underline">
              Jelajahi Novel
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
