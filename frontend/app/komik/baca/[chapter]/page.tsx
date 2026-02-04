'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { komikApi, userApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { FiColumns, FiList, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface ChapterData {
  title: string;
  comicSlug: string;
  comicTitle?: string;
  comicPoster?: string;
  chapterNumber: string;
  images: string[];
  prevChapter?: string;
  nextChapter?: string;
}

type ReadingMode = 'vertical' | 'horizontal';

const READING_MODE_KEY = 'komik-reading-mode';

export default function ReadChapterPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const chapterSlug = params.chapter as string;
  const [chapter, setChapter] = useState<ChapterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const progressSaved = useRef(false);
  
  // Reading mode state
  const [readingMode, setReadingMode] = useState<ReadingMode>('vertical');
  const [currentPage, setCurrentPage] = useState(0);

  // Load reading mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(READING_MODE_KEY);
    if (saved === 'horizontal' || saved === 'vertical') {
      setReadingMode(saved);
    }
  }, []);

  // Save reading mode to localStorage
  const toggleReadingMode = useCallback(() => {
    const newMode = readingMode === 'vertical' ? 'horizontal' : 'vertical';
    setReadingMode(newMode);
    setCurrentPage(0);
    localStorage.setItem(READING_MODE_KEY, newMode);
  }, [readingMode]);

  // Keyboard navigation for horizontal mode
  useEffect(() => {
    if (readingMode !== 'horizontal' || !chapter) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentPage(p => Math.max(0, p - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentPage(p => Math.min(chapter.images.length - 1, p + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readingMode, chapter]);

  // Save reading progress when chapter is loaded
  const saveProgress = async (chapterData: ChapterData) => {
    if (!isAuthenticated || progressSaved.current) return;
    
    try {
      await userApi.saveReadingProgress({
        contentType: 'komik',
        contentSlug: chapterData.comicSlug,
        contentTitle: chapterData.comicTitle || chapterData.title.split(' - ')[0] || 'Unknown',
        contentPoster: chapterData.comicPoster || '',
        chapterSlug: chapterSlug,
        chapterNumber: chapterData.chapterNumber,
        chapterTitle: chapterData.title,
      });
      progressSaved.current = true;
    } catch (err) {
      console.error('Failed to save reading progress:', err);
    }
  };

  useEffect(() => {
    const fetchChapter = async () => {
      setIsLoading(true);
      setError(null);
      progressSaved.current = false; // Reset for new chapter
      setCurrentPage(0); // Reset page for new chapter
      try {
        const response = await komikApi.getChapter(chapterSlug);
        if (response.success) {
          setChapter(response.data);
          // Save progress after loading chapter
          saveProgress(response.data);
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
  }, [chapterSlug, isAuthenticated]);

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

            {/* Title + Page Indicator */}
            <div className="text-center flex-1 mx-4">
              <h1 className="text-white font-medium text-sm sm:text-base truncate">
                {chapter.title}
              </h1>
              {readingMode === 'horizontal' && chapter.images.length > 0 && (
                <p className="text-gray-400 text-xs">
                  Halaman {currentPage + 1} / {chapter.images.length}
                </p>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* Reading Mode Toggle */}
              <button
                onClick={toggleReadingMode}
                className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition"
                title={readingMode === 'vertical' ? 'Ganti ke mode horizontal' : 'Ganti ke mode vertikal'}
              >
                {readingMode === 'vertical' ? (
                  <FiColumns className="w-5 h-5" />
                ) : (
                  <FiList className="w-5 h-5" />
                )}
              </button>
              
              {chapter.prevChapter && (
                <Link
                  href={`/komik/baca/${chapter.prevChapter}`}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded transition hidden sm:block"
                >
                  Prev
                </Link>
              )}
              {chapter.nextChapter && (
                <Link
                  href={`/komik/baca/${chapter.nextChapter}`}
                  className="px-3 py-1.5 bg-primary hover:bg-primary/80 text-white text-sm rounded transition hidden sm:block"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Images */}
      <div className={readingMode === 'horizontal' ? 'h-[calc(100vh-120px)] flex items-center justify-center' : 'max-w-4xl mx-auto py-4'}>
        {chapter.images.length > 0 ? (
          readingMode === 'vertical' ? (
            // Vertical Mode - Scroll through all images
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
            // Horizontal Mode - One page at a time
            <div className="relative w-full h-full flex items-center justify-center px-4">
              {/* Previous Page Button */}
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="absolute left-2 sm:left-8 z-10 p-3 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <FiChevronLeft className="w-6 h-6" />
              </button>

              {/* Current Page */}
              <div className="relative max-h-full max-w-full">
                <Image
                  src={chapter.images[currentPage]}
                  alt={`Page ${currentPage + 1}`}
                  width={800}
                  height={1200}
                  className="max-h-[calc(100vh-140px)] w-auto object-contain mx-auto"
                  priority
                  unoptimized
                />
              </div>

              {/* Next Page Button */}
              <button
                onClick={() => setCurrentPage(p => Math.min(chapter.images.length - 1, p + 1))}
                disabled={currentPage === chapter.images.length - 1}
                className="absolute right-2 sm:right-8 z-10 p-3 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <FiChevronRight className="w-6 h-6" />
              </button>

              {/* Keyboard hint */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-gray-500 text-xs hidden sm:block">
                Gunakan tombol ← → untuk navigasi
              </div>
            </div>
          )
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
            
            <div className="flex items-center gap-4">
              {chapter.comicSlug && (
                <Link
                  href={`/komik/${chapter.comicSlug}`}
                  className="px-4 py-2 text-gray-400 hover:text-white transition"
                >
                  Daftar Chapter
                </Link>
              )}
              
              {/* Page selector for horizontal mode */}
              {readingMode === 'horizontal' && chapter.images.length > 0 && (
                <select
                  value={currentPage}
                  onChange={(e) => setCurrentPage(Number(e.target.value))}
                  className="px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700"
                >
                  {chapter.images.map((_, idx) => (
                    <option key={idx} value={idx}>
                      Halaman {idx + 1}
                    </option>
                  ))}
                </select>
              )}
            </div>

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

