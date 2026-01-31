'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { FiBook, FiUser, FiCalendar, FiTag, FiChevronRight, FiArrowLeft } from 'react-icons/fi';
import { novelApi } from '@/lib/api';

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
}

export default function NovelDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [novel, setNovel] = useState<NovelDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllChapters, setShowAllChapters] = useState(false);

  useEffect(() => {
    const fetchNovel = async () => {
      try {
        const response = await novelApi.getDetail(slug);
        if (response.success) {
          setNovel(response.data);
        }
      } catch (error) {
        console.error('Error fetching novel detail:', error);
      } finally {
        setIsLoading(false);
      }
    };
    if (slug) fetchNovel();
  }, [slug]);

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
              <div className="flex items-center gap-2 text-gray-300">
                <FiUser className="w-4 h-4 text-primary" />
                <span className="text-sm">{novel.author}</span>
              </div>
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
            <div className="flex gap-3">
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
    </div>
  );
}
