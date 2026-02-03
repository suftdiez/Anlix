'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { FiBookmark, FiPlay, FiCheck } from 'react-icons/fi';
import { komikApi, userApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import toast from 'react-hot-toast';

interface Chapter {
  number: string;
  title: string;
  slug: string;
  updatedAt?: string;
}

interface ComicDetail {
  id: string;
  title: string;
  slug: string;
  poster: string;
  type: string;
  author: string;
  released: string;
  synopsis: string;
  genres: string[];
  chapters: Chapter[];
}

interface ReadingProgress {
  chapterSlug: string;
  chapterNumber: string;
  chapterTitle: string;
}

export default function KomikDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { isAuthenticated } = useAuth();
  
  const [comic, setComic] = useState<ComicDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
  const [readingProgress, setReadingProgress] = useState<ReadingProgress | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const response = await komikApi.getDetail(slug);
        if (response.success) {
          setComic(response.data);
        }
        
        // Check bookmark and reading progress status if authenticated
        if (isAuthenticated) {
          try {
            const [bookmarkData, progressData] = await Promise.all([
              userApi.checkBookmark(slug, 'komik'),
              userApi.getReadingProgress(slug, 'komik'),
            ]);
            setIsBookmarked(bookmarkData.isBookmarked);
            setBookmarkId(bookmarkData.bookmark?._id || null);
            
            if (progressData.hasProgress && progressData.data) {
              setReadingProgress({
                chapterSlug: progressData.data.chapterSlug,
                chapterNumber: progressData.data.chapterNumber,
                chapterTitle: progressData.data.chapterTitle,
              });
            }
          } catch (e) {
            // Ignore errors
          }
        }
      } catch (error) {
        console.error('Error fetching comic detail:', error);
      } finally {
        setIsLoading(false);
      }
    };
    if (slug) fetchDetail();
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
      } else if (comic) {
        const data = await userApi.addBookmark({
          contentId: comic.slug,
          contentType: 'komik',
          title: comic.title,
          poster: comic.poster,
          slug: comic.slug,
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
      <div className="container mx-auto px-4 py-6">
        <div className="animate-pulse">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-64 aspect-[3/4] bg-gray-800 rounded-lg" />
            <div className="flex-1 space-y-4">
              <div className="h-8 bg-gray-800 rounded w-3/4" />
              <div className="h-4 bg-gray-800 rounded w-1/2" />
              <div className="h-20 bg-gray-800 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!comic) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-gray-400">Komik tidak ditemukan</p>
        <Link href="/komik" className="text-primary hover:underline mt-4 inline-block">
          Kembali ke Daftar Komik
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-gray-400">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/komik" className="hover:text-primary">Komik</Link>
        <span className="mx-2">/</span>
        <span className="text-white">{comic.title}</span>
      </nav>

      {/* Comic Info */}
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Poster */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="aspect-[3/4] relative rounded-lg overflow-hidden">
            <Image
              src={comic.poster || '/placeholder-comic.jpg'}
              alt={comic.title}
              fill
              className="object-cover"
              sizes="256px"
              priority
            />
          </div>
        </div>

        {/* Details */}
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-4">{comic.title}</h1>
          
          <div className="space-y-2 text-gray-300 mb-4">
            <p><span className="text-gray-500">Type:</span> <span className="px-2 py-0.5 bg-primary/20 text-primary rounded text-sm">{comic.type}</span></p>
            {comic.author && (
              <p>
                <span className="text-gray-500">Author:</span>{' '}
                <Link href={`/komik/author/${encodeURIComponent(comic.author)}`} className="text-primary hover:underline">
                  {comic.author}
                </Link>
              </p>
            )}
            {comic.released && <p><span className="text-gray-500">Released:</span> {comic.released}</p>}
          </div>

          {/* Genres */}
          {comic.genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {comic.genres.map((genre) => (
                <Link
                  key={genre}
                  href={`/komik/genre/${encodeURIComponent(genre.toLowerCase())}`}
                  className="px-3 py-1 bg-gray-800 hover:bg-primary/20 text-gray-300 hover:text-primary text-sm rounded-full transition"
                >
                  {genre}
                </Link>
              ))}
            </div>
          )}

          {/* Synopsis */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-2">Sinopsis</h3>
            <p className="text-gray-400 leading-relaxed">{comic.synopsis}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {/* Continue Reading Button - if user has progress */}
            {readingProgress && (
              <Link
                href={`/komik/baca/${readingProgress.chapterSlug}`}
                className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition flex items-center gap-2"
              >
                <FiPlay className="w-5 h-5" />
                Lanjutkan ({readingProgress.chapterTitle || readingProgress.chapterNumber})
              </Link>
            )}
            
            {comic.chapters.length > 0 && (
              <>
                <Link
                  href={`/komik/baca/${comic.chapters[comic.chapters.length - 1].slug}`}
                  className="px-6 py-3 bg-primary hover:bg-primary/80 text-white font-medium rounded-lg transition"
                >
                  Baca Chapter Pertama
                </Link>
                <Link
                  href={`/komik/baca/${comic.chapters[0].slug}`}
                  className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition"
                >
                  Chapter Terbaru
                </Link>
              </>
            )}
            <button
              onClick={handleBookmark}
              className={`px-6 py-3 flex items-center gap-2 rounded-lg font-medium transition ${
                isBookmarked 
                  ? 'bg-accent/20 border border-accent text-accent' 
                  : 'bg-gray-800 hover:bg-gray-700 text-white'
              }`}
            >
              <FiBookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
              {isBookmarked ? 'Tersimpan' : 'Bookmark'}
            </button>
          </div>
        </div>
      </div>

      {/* Chapter List */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Daftar Chapter ({comic.chapters.length})</h2>
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <div className="max-h-[500px] overflow-y-auto">
            {comic.chapters.map((chapter) => {
              const isRead = readingProgress?.chapterSlug === chapter.slug;
              return (
                <Link
                  key={chapter.slug}
                  href={`/komik/baca/${chapter.slug}`}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-gray-800 border-b border-gray-800 last:border-b-0 transition ${
                    isRead ? 'bg-cyan-900/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isRead && <FiCheck className="w-4 h-4 text-cyan-400" />}
                    <span className={isRead ? 'text-cyan-400' : 'text-white'}>{chapter.title}</span>
                  </div>
                  {chapter.updatedAt && (
                    <span className="text-gray-500 text-sm">{chapter.updatedAt}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
