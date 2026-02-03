'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { FiSearch, FiBook, FiTag, FiArrowLeft } from 'react-icons/fi';
import { komikApi } from '@/lib/api';

interface Comic {
  id: string;
  title: string;
  slug: string;
  poster: string;
  type?: string;
  latestChapter?: string;
}

export default function KomikGenreDetailPage() {
  const params = useParams();
  const genreSlug = params.genre as string;
  const genreName = decodeURIComponent(genreSlug).replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  const [comics, setComics] = useState<Comic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  useEffect(() => {
    const fetchComics = async () => {
      setIsLoading(true);
      try {
        const response = await komikApi.getByGenre(genreSlug, page);
        if (response.success) {
          setComics(response.comics || []);
          setHasNext(response.hasNext || false);
        }
      } catch (error) {
        console.error('Error fetching comics by genre:', error);
      } finally {
        setIsLoading(false);
      }
    };
    if (genreSlug) fetchComics();
  }, [genreSlug, page]);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <Link 
          href="/komik/genre"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition"
        >
          <FiArrowLeft className="w-4 h-4" />
          Kembali ke Genre
        </Link>
        
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 rounded-xl bg-primary/20">
            <FiTag className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              Genre: <span className="gradient-text">{genreName}</span>
            </h1>
            <p className="text-gray-400">
              Koleksi komik dengan genre {genreName}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link href="/komik" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Terbaru
        </Link>
        <Link href="/komik/list" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Semua
        </Link>
        <Link href="/komik/manga" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Manga
        </Link>
        <Link href="/komik/manhwa" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Manhwa
        </Link>
        <Link href="/komik/manhua" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Manhua
        </Link>
        <Link href="/komik/genre" className="px-4 py-2 bg-primary text-white rounded-lg font-medium">
          Genre
        </Link>
      </div>

      {/* Search Button */}
      <Link
        href="/komik/search"
        className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-dark-card border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-primary/50 transition-all"
      >
        <FiSearch className="w-4 h-4" />
        Cari Komik
      </Link>

      {/* Comics Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(18)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] bg-gray-800 rounded-lg mb-2" />
              <div className="h-4 bg-gray-800 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : comics.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {comics.map((comic) => (
            <Link
              key={comic.id}
              href={`/komik/${comic.slug}`}
              className="group relative bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all"
            >
              {/* Poster */}
              <div className="aspect-[3/4] relative overflow-hidden">
                <Image
                  src={comic.poster || '/placeholder-komik.jpg'}
                  alt={comic.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                />
                {/* Type Badge */}
                {comic.type && (
                  <span className={`absolute top-2 left-2 px-2 py-0.5 text-white text-xs font-medium rounded ${
                    comic.type === 'Manga' ? 'bg-red-600' : comic.type === 'Manhwa' ? 'bg-blue-600' : 'bg-green-600'
                  }`}>
                    {comic.type}
                  </span>
                )}
                {/* Latest Chapter Badge */}
                {comic.latestChapter && (
                  <span className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent text-white text-xs">
                    {comic.latestChapter}
                  </span>
                )}
              </div>
              {/* Title */}
              <div className="p-2">
                <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-primary transition">
                  {comic.title}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <FiBook className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">Tidak ada komik dengan genre ini</p>
          <Link href="/komik/genre" className="text-primary hover:underline mt-2 inline-block">
            Lihat genre lainnya
          </Link>
        </div>
      )}

      {/* Pagination */}
      {(hasNext || page > 1) && (
        <div className="flex justify-center gap-4 mt-8">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-6 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition"
          >
            Sebelumnya
          </button>
          <span className="px-4 py-2 text-white">Halaman {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!hasNext}
            className="px-6 py-2 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/80 transition"
          >
            Selanjutnya
          </button>
        </div>
      )}
    </div>
  );
}
