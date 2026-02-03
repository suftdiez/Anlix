'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { FiBook, FiUser, FiCalendar, FiTag, FiChevronRight, FiArrowLeft, FiBookmark, FiPlay } from 'react-icons/fi';
import { novelApi, userApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import toast from 'react-hot-toast';

interface Chapter {
  id: string;
  number: string;
  title: string;
  slug: string;
  type?: string;
  date?: string;
  url: string;
}

interface NovelDetail {
  id: string;
  title: string;
  slug: string;
  poster: string;
  alternativeTitle?: string;
  author?: string;
  genres: string[];
  novelType?: string;
  tags?: string[];
  release?: string;
  status?: string;
  synopsis: string;
  chapters: Chapter[];
  related?: {
    id: string;
    title: string;
    slug: string;
    poster: string;
    latestChapter?: string;
    type?: string;
  }[];
}

export default function NovelDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { isAuthenticated } = useAuth();
  const [novel, setNovel] = useState<NovelDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllChapters, setShowAllChapters] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
  const [readingProgress, setReadingProgress] = useState<{
    chapterSlug: string;
    chapterNumber: string;
    chapterTitle: string;
  } | null>(null);

  useEffect(() => {
    const fetchNovel = async () => {
      try {
        const response = await novelApi.getDetail(slug);
        if (response.success) {
          setNovel(response.data);
        }

        // Check bookmark status and reading progress
        if (isAuthenticated) {
          try {
            const [bookmarkData, progressData] = await Promise.all([
              userApi.checkBookmark(slug, 'novel'),
              userApi.getReadingProgress(slug, 'novel'),
            ]);
            setIsBookmarked(bookmarkData.isBookmarked);
            setBookmarkId(bookmarkData.bookmark?._id || null);
            if (progressData.hasProgress) {
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
        console.error('Error fetching novel detail:', error);
      } finally {
        setIsLoading(false);
      }
    };
    if (slug) fetchNovel();
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
      } else if (novel) {
        const data = await userApi.addBookmark({
          contentId: novel.slug,
          contentType: 'novel',
          title: novel.title,
          poster: novel.poster,
          slug: novel.slug,
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
          <div className="flex gap-6 mb-8">
            <div className="w-48 h-72 bg-gray-800 rounded-lg" />
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

  if (!novel) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <FiBook className="w-16 h-16 mx-auto text-gray-600 mb-4" />
        <h2 className="text-xl text-white mb-2">Novel tidak ditemukan</h2>
        <Link href="/novel" className="text-primary hover:underline">
          Kembali ke daftar novel
        </Link>
      </div>
    );
  }

  const displayedChapters = showAllChapters ? novel.chapters : novel.chapters.slice(0, 50);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Back Button */}
      <Link href="/novel" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition">
        <FiArrowLeft className="w-4 h-4" />
        Kembali
      </Link>

      {/* Novel Info */}
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Poster */}
        <div className="w-48 flex-shrink-0 mx-auto md:mx-0">
          <div className="aspect-[3/4] relative rounded-lg overflow-hidden">
            <Image
              src={novel.poster || '/placeholder-novel.jpg'}
              alt={novel.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>

        {/* Details */}
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            {novel.title}
          </h1>
          
          {novel.alternativeTitle && (
            <p className="text-gray-400 text-sm mb-4">{novel.alternativeTitle}</p>
          )}

          {/* Meta Info */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {novel.author && (
              <Link 
                href={`/novel/author/${novel.author.toLowerCase().replace(/\s+/g, '-')}`}
                className="flex items-center gap-2 text-gray-300 hover:text-primary transition"
              >
                <FiUser className="w-4 h-4 text-primary" />
                <span className="text-sm hover:underline">{novel.author}</span>
              </Link>
            )}
            {novel.novelType && (
              <div className="flex items-center gap-2 text-gray-300">
                <FiBook className="w-4 h-4 text-primary" />
                <span className="text-sm">{novel.novelType}</span>
              </div>
            )}
            {novel.status && (
              <div className="flex items-center gap-2 text-gray-300">
                <FiTag className="w-4 h-4 text-primary" />
                <span className={`text-sm px-2 py-0.5 rounded ${
                  novel.status.toLowerCase().includes('completed') || novel.status.toLowerCase().includes('tamat')
                    ? 'bg-green-600/20 text-green-400'
                    : 'bg-blue-600/20 text-blue-400'
                }`}>
                  {novel.status}
                </span>
              </div>
            )}
            {novel.release && (
              <div className="flex items-center gap-2 text-gray-300">
                <FiCalendar className="w-4 h-4 text-primary" />
                <span className="text-sm">{novel.release}</span>
              </div>
            )}
          </div>

          {/* Genres */}
          {novel.genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {novel.genres.map((genre, idx) => (
                <Link
                  key={idx}
                  href={`/novel/genre/${genre.toLowerCase().replace(/\s+/g, '-')}`}
                  className="px-3 py-1 bg-gray-800 text-gray-300 text-sm rounded-full hover:bg-primary/20 hover:text-primary transition"
                >
                  {genre}
                </Link>
              ))}
            </div>
          )}

          {/* Synopsis */}
          <div className="mb-4">
            <h3 className="text-white font-semibold mb-2">Sinopsis</h3>
            <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">
              {novel.synopsis}
            </p>
          </div>

          {/* Quick Read Buttons */}
          {novel.chapters.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {/* Continue Reading - shows if user has progress */}
              {readingProgress && (
                <Link
                  href={`/novel/baca/${novel.slug}/${readingProgress.chapterSlug}`}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition font-medium"
                >
                  <FiPlay className="w-4 h-4" />
                  Lanjutkan {readingProgress.chapterNumber || readingProgress.chapterTitle || 
                    (() => {
                      const match = readingProgress.chapterSlug?.match(/chapter[- ]?(\d+)/i);
                      return match ? `(Chapter ${match[1]})` : '';
                    })()}
                </Link>
              )}
              <Link
                href={`/novel/baca/${novel.slug}/${novel.chapters[novel.chapters.length - 1].slug}`}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition font-medium"
              >
                Baca Dari Awal
              </Link>
              <Link
                href={`/novel/baca/${novel.slug}/${novel.chapters[0].slug}`}
                className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition font-medium"
              >
                Baca Terbaru
              </Link>
              <button
                onClick={handleBookmark}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition ${
                  isBookmarked 
                    ? 'bg-primary/20 text-primary border border-primary' 
                    : 'bg-gray-800 text-white hover:bg-gray-700'
                }`}
              >
                <FiBookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
                {isBookmarked ? 'Tersimpan' : 'Bookmark'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chapter List */}
      <div className="bg-gray-900 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FiBook className="w-5 h-5 text-primary" />
            Daftar Chapter ({novel.chapters.length})
          </h2>
        </div>

        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {displayedChapters.map((chapter) => (
            <Link
              key={chapter.id}
              href={`/novel/baca/${novel.slug}/${chapter.slug}`}
              className="flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition group"
            >
              <div className="flex items-center gap-3">
                <span className="text-white group-hover:text-primary transition">
                  {chapter.title}
                </span>
                {chapter.type && (
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    chapter.type === 'HTL' ? 'bg-green-600/20 text-green-400' : 'bg-blue-600/20 text-blue-400'
                  }`}>
                    {chapter.type}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                {chapter.date && <span className="text-sm">{chapter.date}</span>}
                <FiChevronRight className="w-4 h-4 group-hover:text-primary transition" />
              </div>
            </Link>
          ))}
        </div>

        {/* Show More Button */}
        {novel.chapters.length > 50 && !showAllChapters && (
          <button
            onClick={() => setShowAllChapters(true)}
            className="w-full mt-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 hover:text-white transition"
          >
            Tampilkan Semua ({novel.chapters.length} Chapter)
          </button>
        )}
      </div>

      {/* Related Novels */}
      {novel.related && novel.related.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <FiBook className="w-5 h-5 text-primary" />
            Novel Terkait
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {novel.related.slice(0, 6).map((relatedNovel) => (
              <Link
                key={relatedNovel.id}
                href={`/novel/${relatedNovel.slug}`}
                className="group relative bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all"
              >
                <div className="aspect-[3/4] relative overflow-hidden">
                  <Image
                    src={relatedNovel.poster || '/placeholder-novel.jpg'}
                    alt={relatedNovel.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                  />
                  {relatedNovel.type && (
                    <span className={`absolute top-2 left-2 px-2 py-0.5 text-white text-xs font-medium rounded ${
                      relatedNovel.type === 'HTL' ? 'bg-green-600' : 'bg-blue-600'
                    }`}>
                      {relatedNovel.type}
                    </span>
                  )}
                  {relatedNovel.latestChapter && (
                    <span className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent text-white text-xs">
                      {relatedNovel.latestChapter}
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-primary transition">
                    {relatedNovel.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
