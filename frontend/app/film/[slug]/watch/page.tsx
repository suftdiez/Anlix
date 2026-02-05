'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { filmApi, userApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { FiPlay, FiChevronLeft, FiMonitor, FiAlertCircle } from 'react-icons/fi';

interface StreamServer {
  name: string;
  url: string;
  quality?: string;
}

interface FilmDetail {
  id: string;
  title: string;
  slug: string;
  poster: string;
  year?: string;
  rating?: string;
  synopsis: string;
  genres?: string[];
  servers: StreamServer[];
}

export default function FilmWatchPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { isAuthenticated } = useAuth();

  const [film, setFilm] = useState<FilmDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFilmDetail = async () => {
      if (!slug) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await filmApi.getDetail(slug);
        if (response.success && response.data) {
          setFilm(response.data);
        } else {
          setError('Film tidak ditemukan');
        }
      } catch (err) {
        console.error('Failed to fetch film detail:', err);
        setError('Gagal memuat data film');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFilmDetail();
  }, [slug]);

  // Open video in new tab and save to history
  const handleWatchServer = async (server: StreamServer) => {
    if (server.url) {
      // Save to watch history when user clicks to watch
      if (isAuthenticated && film) {
        try {
          await userApi.addHistory({
            contentId: slug,
            contentType: 'film',
            episodeId: slug, // For films, we use slug as episode ID
            episodeNumber: 1, // Films don't have episodes
            title: film.title,
            episodeTitle: film.title,
            poster: film.poster,
            slug: slug,
            progress: 50, // Mark as 50% since we can't track actual progress in new tab
          });
        } catch (e) {
          // Ignore errors
        }
      }
      window.open(server.url, '_blank', 'noopener,noreferrer');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="aspect-video bg-gray-800 rounded-xl mb-4" />
          <div className="h-8 bg-gray-800 rounded w-3/4 mb-4" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-24 bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !film) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-20">
          <FiAlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <p className="text-red-400 mb-4">{error || 'Film tidak ditemukan'}</p>
          <button
            onClick={() => router.back()}
            className="btn-primary"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-gray-400">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/film" className="hover:text-primary">Film</Link>
        <span className="mx-2">/</span>
        <Link href={`/film/${film.slug}`} className="hover:text-primary">{film.title}</Link>
        <span className="mx-2">/</span>
        <span className="text-white">Nonton</span>
      </nav>

      {/* Film Title */}
      <h1 className="text-xl md:text-2xl font-bold text-white mb-6">
        {film.title}
        {film.year && <span className="text-gray-500 text-lg ml-2">({film.year})</span>}
      </h1>

      {/* Server Selection */}
      {film.servers && film.servers.length > 0 ? (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FiPlay className="w-5 h-5 text-primary" />
            Pilih Server untuk Menonton:
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {film.servers.map((server, idx) => (
              <button
                key={idx}
                onClick={() => handleWatchServer(server)}
                className="group relative bg-gradient-to-br from-gray-800 to-gray-900 hover:from-primary/20 hover:to-primary/10 border border-gray-700 hover:border-primary/50 rounded-xl p-6 text-left transition-all duration-300 transform hover:scale-[1.02]"
              >
                {/* Play icon */}
                <div className="absolute top-4 right-4 w-12 h-12 bg-primary/20 group-hover:bg-primary rounded-full flex items-center justify-center transition-all">
                  <FiPlay className="w-6 h-6 text-primary group-hover:text-white transition-colors" />
                </div>
                
                <div className="pr-14">
                  <h4 className="text-lg font-bold text-white mb-1">{server.name}</h4>
                  {server.quality && (
                    <span className="inline-block px-2 py-0.5 bg-primary/20 text-primary text-xs font-medium rounded">
                      {server.quality}
                    </span>
                  )}
                  <p className="text-gray-400 text-sm mt-2">
                    Klik untuk menonton
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-gray-800/50 rounded-xl p-8 text-center mb-8">
          <FiMonitor className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400 text-lg">Tidak ada server tersedia</p>
          <p className="text-gray-500 mt-2">Silakan coba film lain atau kembali lagi nanti</p>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-xl p-5 mb-8">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
            <FiAlertCircle className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h4 className="text-white font-semibold mb-2">Cara Menonton</h4>
            <ul className="text-sm text-gray-300 space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 bg-primary/20 text-primary text-xs font-bold rounded-full flex items-center justify-center">1</span>
                Pilih salah satu server di atas
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 bg-primary/20 text-primary text-xs font-bold rounded-full flex items-center justify-center">2</span>
                Video akan terbuka di tab baru
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 bg-primary/20 text-primary text-xs font-bold rounded-full flex items-center justify-center">3</span>
                Jika tidak berfungsi, coba server lain
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
        <h4 className="text-sm font-semibold text-white mb-2">Tips Nonton:</h4>
        <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
          <li>Gunakan browser Chrome/Firefox untuk hasil terbaik</li>
          <li>Matikan Adblock jika video tidak berjalan</li>
          <li>Jika satu server error, coba server lainnya</li>
          <li>Beberapa server mungkin memerlukan waktu loading</li>
        </ul>
      </div>

      {/* Back to Detail */}
      <Link
        href={`/film/${film.slug}`}
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <FiChevronLeft className="w-4 h-4" />
        Kembali ke Detail Film
      </Link>
    </div>
  );
}
