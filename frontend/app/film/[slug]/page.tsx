'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { filmApi, userApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { FiBookmark, FiFolderPlus } from 'react-icons/fi';
import toast from 'react-hot-toast';
import FilmReviews from '@/components/film/FilmReviews';
import AddToCollectionModal from '@/components/film/AddToCollectionModal';
import TrailerPlayer from '@/components/film/TrailerPlayer';

interface StreamServer {
  name: string;
  url: string;
  quality?: string;
}

interface FilmItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  year?: string;
  url?: string;
}

interface FilmDetail {
  id: string;
  title: string;
  slug: string;
  poster: string;
  year?: string;
  rating?: string;
  duration?: string;
  synopsis: string;
  genres?: string[];
  director?: string;
  actors?: string[];
  country?: string;
  translator?: string;
  servers: StreamServer[];
  relatedFilms?: FilmItem[];
  isSeries?: boolean;
}

export default function FilmDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [film, setFilm] = useState<FilmDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
  const [showCollectionModal, setShowCollectionModal] = useState(false);

  useEffect(() => {
    const fetchFilmDetail = async () => {
      if (!slug) return;

      setIsLoading(true);
      setError(null);

      try {
        // First try to get film detail
        const response = await filmApi.getDetail(slug);
        if (response.success && response.data) {
          // Check if it might be a series (no servers = likely series)
          if (!response.data.servers || response.data.servers.length === 0) {
            // Try to get series detail
            try {
              const seriesResponse = await filmApi.getSeriesDetail(slug);
              if (seriesResponse.success && seriesResponse.data) {
                setFilm({ ...seriesResponse.data, isSeries: true });
                return;
              }
            } catch {
              // Not a series, continue with film
            }
          }
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

  // Check bookmark status
  useEffect(() => {
    const checkBookmarkStatus = async () => {
      if (!isAuthenticated || !slug) return;
      try {
        const data = await userApi.checkBookmark(slug, 'film');
        setIsBookmarked(data.isBookmarked);
        setBookmarkId(data.bookmark?._id || null);
      } catch (e) {
        // Ignore errors
      }
    };
    checkBookmarkStatus();
  }, [isAuthenticated, slug]);

  const handleBookmark = async () => {
    if (!isAuthenticated) {
      toast.error('Silakan login untuk menyimpan ke watchlist');
      return;
    }

    try {
      if (isBookmarked && bookmarkId) {
        await userApi.removeBookmark(bookmarkId);
        setIsBookmarked(false);
        setBookmarkId(null);
        toast.success('Dihapus dari watchlist');
      } else if (film) {
        const data = await userApi.addBookmark({
          contentId: film.slug,
          contentType: 'film',
          title: film.title,
          poster: film.poster,
          slug: film.slug,
        });
        setIsBookmarked(true);
        setBookmarkId(data.data._id);
        toast.success('Ditambahkan ke watchlist');
      }
    } catch (error) {
      toast.error('Gagal mengupdate watchlist');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-1/3 lg:w-1/4">
              <div className="aspect-[2/3] bg-gray-800 rounded-xl" />
            </div>
            <div className="flex-1 space-y-4">
              <div className="h-8 bg-gray-800 rounded w-3/4" />
              <div className="h-4 bg-gray-800 rounded w-1/2" />
              <div className="h-32 bg-gray-800 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !film) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-20">
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
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-gray-400">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/film" className="hover:text-primary">Film</Link>
        <span className="mx-2">/</span>
        <span className="text-white">{film.title}</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Poster */}
        <div className="w-full lg:w-1/4 flex-shrink-0">
          <div className="aspect-[2/3] relative rounded-xl overflow-hidden bg-gray-800">
            {film.poster ? (
              <Image
                src={film.poster}
                alt={film.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 25vw"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                No Poster
              </div>
            )}
          </div>

          {/* Series: Show Episodes Button */}
          {film.isSeries && (
            <Link
              href={`/film/${film.slug}/episodes`}
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Lihat Episode
            </Link>
          )}

          {/* Film: Watch Button */}
          {!film.isSeries && film.servers && film.servers.length > 0 && (
            <Link
              href={`/film/${film.slug}/watch`}
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              Tonton Sekarang
            </Link>
          )}

          {/* Watch Trailer Button */}
          <TrailerPlayer slug={film.slug} filmTitle={film.title} />

          {/* Watchlist Button */}
          <button
            onClick={handleBookmark}
            className={`w-full mt-3 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
              isBookmarked
                ? 'bg-primary/20 border border-primary text-primary'
                : 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-gray-600'
            }`}
          >
            <FiBookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
            {isBookmarked ? 'Tersimpan di Watchlist' : 'Tambah ke Watchlist'}
          </button>

          {/* Add to Collection Button */}
          {isAuthenticated && (
            <button
              onClick={() => setShowCollectionModal(true)}
              className="w-full mt-3 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-gray-600"
            >
              <FiFolderPlus className="w-5 h-5" />
              Tambah ke Koleksi
            </button>
          )}
        </div>

        {/* Info */}
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-display font-bold text-white mb-2">
            {film.title}
          </h1>

          {/* Meta Info */}
          <div className="flex flex-wrap gap-3 mb-4 text-sm">
            {film.year && (
              <span className="px-3 py-1 bg-primary/20 text-primary rounded-full">
                {film.year}
              </span>
            )}
            {film.rating && (
              <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {film.rating}
              </span>
            )}
            {film.duration && (
              <span className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full">
                {film.duration}
              </span>
            )}
            {film.country && (
              <span className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full">
                {film.country}
              </span>
            )}
          </div>

          {/* Genres */}
          {film.genres && film.genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {film.genres.map((genre, idx) => (
                <Link
                  key={idx}
                  href={`/film?genre=${genre.toLowerCase()}`}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
                >
                  {genre}
                </Link>
              ))}
            </div>
          )}

          {/* Synopsis */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-2">Sinopsis</h2>
            <p className="text-gray-400 leading-relaxed">
              {film.synopsis}
            </p>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {film.director && (
              <div>
                <span className="text-gray-500">Sutradara:</span>
                <span className="text-white ml-2">{film.director}</span>
              </div>
            )}
            {film.translator && (
              <div>
                <span className="text-gray-500">Subtitle:</span>
                <span className="text-white ml-2">{film.translator}</span>
              </div>
            )}
            {film.actors && film.actors.length > 0 && (
              <div className="md:col-span-2">
                <span className="text-gray-500">Pemeran:</span>
                <span className="text-white ml-2">{film.actors.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Available Servers Info */}
          {film.servers && film.servers.length > 0 && (
            <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
              <p className="text-gray-400 text-sm">
                <span className="text-green-400">✓</span> {film.servers.length} server tersedia untuk streaming
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Related Films */}
      {film.relatedFilms && film.relatedFilms.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl md:text-2xl font-display font-bold text-white mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            Film Terkait
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {film.relatedFilms.map((item, index) => (
              <Link
                key={`${item.slug}-${index}`}
                href={`/film/${item.slug}`}
                className="group relative bg-dark-card rounded-lg overflow-hidden border border-white/5 hover:border-primary/50 transition-all hover:scale-105"
              >
                <div className="aspect-[2/3] relative">
                  {item.poster ? (
                    <Image
                      src={item.poster}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-500 text-xs">
                      No Poster
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="p-2">
                  <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  {item.year && (
                    <span className="text-xs text-gray-500">{item.year}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Reviews Section */}
      <FilmReviews contentId={film.slug} filmTitle={film.title} />

      {/* Add to Collection Modal */}
      {showCollectionModal && (
        <AddToCollectionModal
          isOpen={showCollectionModal}
          onClose={() => setShowCollectionModal(false)}
          film={{
            filmId: film.slug,
            title: film.title,
            slug: film.slug,
            poster: film.poster,
            year: film.year,
            quality: 'HD',
          }}
        />
      )}
    </div>
  );
}
