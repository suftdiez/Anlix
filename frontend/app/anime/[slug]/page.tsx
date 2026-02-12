'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiPlay, FiBookmark, FiStar, FiCalendar, FiClock, FiFilm, FiCheck } from 'react-icons/fi';
import { animeApi, userApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getImageUrl } from '@/lib/utils';
import { DetailSkeleton, EpisodeListSkeleton } from '@/components';
import toast from 'react-hot-toast';
import ContentReviews from '@/components/shared/ContentReviews';
import RelatedAnime from '@/components/shared/RelatedAnime';

interface Episode {
  id: string;
  number: string;
  title: string;
  slug: string;
  url: string;
  date?: string;
}

interface AnimeDetail {
  id: string;
  title: string;
  slug: string;
  poster: string;
  synopsis: string;
  type?: string;
  status?: string;
  score?: string;
  duration?: string;
  studio?: string;
  season?: string;
  released?: string;
  totalEpisodes?: string;
  genres?: string[];
  episodes: Episode[];
}

export default function AnimeDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { isAuthenticated } = useAuth();

  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await animeApi.getDetail(slug);
        setAnime(data.data);

        // Check bookmark status
        if (isAuthenticated) {
          try {
            const bookmarkData = await userApi.checkBookmark(slug, 'anime');
            setIsBookmarked(bookmarkData.isBookmarked);
            setBookmarkId(bookmarkData.bookmark?._id || null);
          } catch (e) {
            // Ignore errors
          }
        }
      } catch (error) {
        console.error('Failed to fetch anime:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [slug, isAuthenticated]);

  const handleBookmark = async () => {
    if (!isAuthenticated) {
      toast.error('Silakan login untuk bookmark');
      return;
    }

    try {
      if (isBookmarked && bookmarkId) {
        await userApi.removeBookmark(bookmarkId);
        setIsBookmarked(false);
        setBookmarkId(null);
        toast.success('Bookmark dihapus');
      } else if (anime) {
        const data = await userApi.addBookmark({
          contentId: anime.slug,
          contentType: 'anime',
          title: anime.title,
          poster: anime.poster,
          slug: anime.slug,
        });
        setIsBookmarked(true);
        setBookmarkId(data.data._id);
        toast.success('Ditambahkan ke bookmark');
      }
    } catch (error) {
      toast.error('Gagal mengupdate bookmark');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <DetailSkeleton />
        <div className="mt-8">
          <div className="skeleton h-8 w-48 mb-4" />
          <EpisodeListSkeleton count={24} />
        </div>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl text-gray-400">Anime tidak ditemukan</h1>
      </div>
    );
  }

  return (
    <div>
      {/* Banner */}
      <div className="relative h-[50vh] md:h-[60vh] overflow-hidden">
        <Image
          src={getImageUrl(anime.poster)}
          alt={anime.title}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-dark via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 -mt-40 relative z-10">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Poster */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-shrink-0 w-48 md:w-64 mx-auto md:mx-0"
          >
            <div className="relative aspect-poster rounded-xl overflow-hidden shadow-2xl border border-white/10">
              <Image
                src={getImageUrl(anime.poster)}
                alt={anime.title}
                fill
                className="object-cover"
              />
            </div>
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1"
          >
            {/* Type Badge */}
            {anime.type && (
              <span className="badge-primary mb-3">{anime.type}</span>
            )}

            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
              {anime.title}
            </h1>

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
              {anime.score && (
                <div className="flex items-center gap-1 text-accent">
                  <FiStar className="w-4 h-4 fill-current" />
                  <span className="font-semibold">{anime.score}</span>
                </div>
              )}
              {anime.status && (
                <div className="flex items-center gap-1 text-gray-400">
                  <FiCheck className="w-4 h-4" />
                  <span>{anime.status}</span>
                </div>
              )}
              {anime.released && (
                <div className="flex items-center gap-1 text-gray-400">
                  <FiCalendar className="w-4 h-4" />
                  <span>{anime.released}</span>
                </div>
              )}
              {anime.duration && (
                <div className="flex items-center gap-1 text-gray-400">
                  <FiClock className="w-4 h-4" />
                  <span>{anime.duration}</span>
                </div>
              )}
              {anime.totalEpisodes && (
                <div className="flex items-center gap-1 text-gray-400">
                  <FiFilm className="w-4 h-4" />
                  <span>{anime.totalEpisodes} Episode</span>
                </div>
              )}
            </div>

            {/* Genres */}
            {anime.genres && anime.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {anime.genres.map((genre) => (
                  <Link
                    key={genre}
                    href={`/genre/${genre.toLowerCase()}`}
                    className="genre-tag"
                  >
                    {genre}
                  </Link>
                ))}
              </div>
            )}

            {/* Synopsis */}
            <p className="text-gray-300 leading-relaxed mb-6">
              {anime.synopsis || 'Tidak ada sinopsis.'}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-4">
              {anime.episodes.length > 0 && (
                <Link
                  href={`/anime/${slug}/${anime.episodes[0].slug}`}
                  className="btn-primary flex items-center gap-2"
                >
                  <FiPlay className="w-5 h-5" />
                  <span>Tonton Sekarang</span>
                </Link>
              )}
              <button
                onClick={handleBookmark}
                className={`btn-secondary flex items-center gap-2 ${isBookmarked ? 'border-accent text-accent' : ''}`}
              >
                <FiBookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
                <span>{isBookmarked ? 'Tersimpan' : 'Bookmark'}</span>
              </button>
            </div>
          </motion.div>
        </div>

        {/* Episodes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-12"
        >
          <h2 className="section-title flex items-center gap-3 mb-6">
            <span className="w-1 h-8 bg-gradient-to-b from-primary to-accent rounded-full" />
            Daftar Episode
          </h2>

          {anime.episodes.length > 0 ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
              {anime.episodes.map((episode) => (
                <Link
                  key={episode.id}
                  href={`/anime/${slug}/${episode.slug}`}
                  className="p-3 bg-dark-card border border-white/5 rounded-lg text-center text-sm font-medium text-gray-300 hover:bg-primary/20 hover:border-primary/50 hover:text-white transition-all"
                >
                  {episode.number || episode.title}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              Belum ada episode tersedia
            </p>
          )}
        </motion.div>

        {/* Reviews & Rating */}
        <ContentReviews
          contentId={slug as string}
          contentType="anime"
          contentTitle={anime.title}
        />

        {/* Related Anime */}
        <RelatedAnime
          currentSlug={slug}
          genres={anime.genres}
          title={anime.title}
        />
      </div>
    </div>
  );
}
