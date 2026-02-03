'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiArrowRight, FiBook, FiHome, FiSettings } from 'react-icons/fi';
import { novelApi, userApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface ChapterContent {
  title: string;
  novelTitle: string;
  chapterNumber: string;
  content: string;
  prevChapter?: string;
  nextChapter?: string;
}

export default function NovelReaderPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const slugParts = params.slug as string[];
  const novelSlug = slugParts[0];
  const chapterSlug = slugParts.slice(1).join('/');
  
  const [chapter, setChapter] = useState<ChapterContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fontSize, setFontSize] = useState(18);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const fetchChapter = async () => {
      setIsLoading(true);
      try {
        const response = await novelApi.readChapter(novelSlug, chapterSlug);
        if (response.success) {
          setChapter(response.data);
          
          // Save reading progress if authenticated
          if (isAuthenticated) {
            try {
              // Get novel detail for poster and correct title
              const novelDetail = await novelApi.getDetail(novelSlug);
              const poster = novelDetail?.data?.poster || '';
              const title = novelDetail?.data?.title || response.data.novelTitle;
              
              await userApi.saveReadingProgress({
                contentType: 'novel',
                contentSlug: novelSlug,
                contentTitle: title,
                contentPoster: poster,
                chapterSlug,
                chapterNumber: response.data.chapterNumber,
                chapterTitle: response.data.title,
              });
            } catch (e) {
              // Ignore save errors silently
            }
          }
        }
      } catch (error) {
        console.error('Error fetching chapter:', error);
      } finally {
        setIsLoading(false);
      }
    };
    if (novelSlug && chapterSlug) fetchChapter();
  }, [novelSlug, chapterSlug, isAuthenticated]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && chapter?.prevChapter) {
        router.push(`/novel/baca/${novelSlug}/${chapter.prevChapter}`);
      } else if (e.key === 'ArrowRight' && chapter?.nextChapter) {
        router.push(`/novel/baca/${novelSlug}/${chapter.nextChapter}`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chapter, novelSlug, router]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-3/4" />
          <div className="h-4 bg-gray-800 rounded w-1/2" />
          <div className="space-y-2 mt-8">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <FiBook className="w-16 h-16 mx-auto text-gray-600 mb-4" />
        <h2 className="text-xl text-white mb-2">Chapter tidak ditemukan</h2>
        <Link href={`/novel/${novelSlug}`} className="text-primary hover:underline">
          Kembali ke halaman novel
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-dark-card/95 backdrop-blur border-b border-white/10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/novel/${novelSlug}`}
              className="p-2 text-gray-400 hover:text-white transition"
            >
              <FiHome className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-white font-medium line-clamp-1">{chapter.title}</h1>
              <p className="text-gray-400 text-sm">{chapter.novelTitle}</p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-400 hover:text-white transition"
          >
            <FiSettings className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="border-t border-white/10 px-4 py-3">
            <div className="flex items-center justify-center gap-4">
              <span className="text-gray-400 text-sm">Ukuran Font:</span>
              <button
                onClick={() => setFontSize(f => Math.max(14, f - 2))}
                className="px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-700"
              >
                A-
              </button>
              <span className="text-white">{fontSize}px</span>
              <button
                onClick={() => setFontSize(f => Math.min(28, f + 2))}
                className="px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-700"
              >
                A+
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <article 
          className="prose prose-invert prose-lg max-w-none"
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
        >
          <div className="text-gray-200 whitespace-pre-line leading-relaxed">
            {chapter.content}
          </div>
        </article>
      </div>

      {/* Navigation Footer */}
      <div className="sticky bottom-0 bg-dark-card/95 backdrop-blur border-t border-white/10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {chapter.prevChapter ? (
            <Link
              href={`/novel/baca/${novelSlug}/${chapter.prevChapter}`}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
            >
              <FiArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Sebelumnya</span>
            </Link>
          ) : (
            <div />
          )}

          <Link
            href={`/novel/${novelSlug}`}
            className="px-4 py-2 text-gray-400 hover:text-white transition"
          >
            Daftar Chapter
          </Link>

          {chapter.nextChapter ? (
            <Link
              href={`/novel/baca/${novelSlug}/${chapter.nextChapter}`}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition"
            >
              <span className="hidden sm:inline">Selanjutnya</span>
              <FiArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <div className="px-4 py-2 text-gray-600">
              Chapter Terakhir
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
