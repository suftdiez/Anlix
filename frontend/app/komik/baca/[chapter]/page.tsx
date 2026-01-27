'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { komikApi } from '@/lib/api';

interface ChapterData {
  title: string;
  comicSlug: string;
  chapterNumber: string;
  images: string[];
  prevChapter?: string;
  nextChapter?: string;
}

export default function ReadChapterPage() {
  const params = useParams();
  const router = useRouter();
  const chapterSlug = params.chapter as string;
  const [chapter, setChapter] = useState<ChapterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChapter = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await komikApi.getChapter(chapterSlug);
        if (response.success) {
          setChapter(response.data);
        } else {
          setError('Gagal memuat chapter');
        }
      } catch (err) {
        console.error('Error fetching chapter:', err);
        setError('Gagal memuat chapter');
      } finally {
        setIsLoading(false);
      }
    };
    if (chapterSlug) fetchChapter();
  }, [chapterSlug]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-400">Memuat chapter...</p>
        </div>
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Chapter tidak ditemukan'}</p>
          <button onClick={() => router.back()} className="text-primary hover:underline">
            Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Back button */}
            {chapter.comicSlug && (
              <Link
                href={`/komik/${chapter.comicSlug}`}
                className="text-gray-400 hover:text-white transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="hidden sm:inline">Kembali</span>
              </Link>
            )}

            {/* Title */}
            <h1 className="text-white font-medium text-sm sm:text-base truncate max-w-xs sm:max-w-md">
              {chapter.title}
            </h1>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              {chapter.prevChapter && (
                <Link
                  href={`/komik/baca/${chapter.prevChapter}`}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded transition"
                >
                  Prev
                </Link>
              )}
              {chapter.nextChapter && (
                <Link
                  href={`/komik/baca/${chapter.nextChapter}`}
                  className="px-3 py-1.5 bg-primary hover:bg-primary/80 text-white text-sm rounded transition"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Images */}
      <div className="max-w-4xl mx-auto py-4">
        {chapter.images.length > 0 ? (
          <div className="space-y-0">
            {chapter.images.map((img, idx) => (
              <div key={idx} className="relative w-full">
                <Image
                  src={img}
                  alt={`Page ${idx + 1}`}
                  width={800}
                  height={1200}
                  className="w-full h-auto"
                  priority={idx < 3}
                  loading={idx < 3 ? 'eager' : 'lazy'}
                  unoptimized
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-400">Tidak ada gambar ditemukan</p>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur border-t border-gray-800">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {chapter.prevChapter ? (
              <Link
                href={`/komik/baca/${chapter.prevChapter}`}
                className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition"
              >
                ← Previous
              </Link>
            ) : (
              <div />
            )}
            
            {chapter.comicSlug && (
              <Link
                href={`/komik/${chapter.comicSlug}`}
                className="px-4 py-2 text-gray-400 hover:text-white transition"
              >
                Daftar Chapter
              </Link>
            )}

            {chapter.nextChapter ? (
              <Link
                href={`/komik/baca/${chapter.nextChapter}`}
                className="px-6 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg transition"
              >
                Next →
              </Link>
            ) : (
              <div />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
