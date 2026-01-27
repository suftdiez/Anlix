'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { komikApi } from '@/lib/api';

interface Comic {
  id: string;
  title: string;
  slug: string;
  poster: string;
}

export default function ManhuaPage() {
  const [comics, setComics] = useState<Comic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  useEffect(() => {
    const fetchComics = async () => {
      setIsLoading(true);
      try {
        const response = await komikApi.getManhua(page);
        if (response.success) {
          setComics(response.comics);
          setHasNext(response.hasNext);
        }
      } catch (error) {
        console.error('Error fetching manhua:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchComics();
  }, [page]);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Manhua</h1>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link href="/komik" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Update
        </Link>
        <Link href="/komik/list" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          List
        </Link>
        <Link href="/komik/manga" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Manga
        </Link>
        <Link href="/komik/manhwa" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Manhwa
        </Link>
        <Link href="/komik/manhua" className="px-4 py-2 bg-primary text-white rounded-lg font-medium">
          Manhua
        </Link>
      </div>

      {/* Comics Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(24)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] bg-gray-800 rounded-lg mb-2" />
              <div className="h-4 bg-gray-800 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {comics.map((comic) => (
            <Link
              key={comic.id}
              href={`/komik/${comic.slug}`}
              className="group relative bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all"
            >
              <div className="aspect-[3/4] relative overflow-hidden">
                <Image
                  src={comic.poster || '/placeholder-comic.jpg'}
                  alt={comic.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                />
              </div>
              <div className="p-2">
                <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-primary transition">
                  {comic.title}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center gap-4 mt-8">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Sebelumnya
        </button>
        <span className="px-4 py-2 text-white">Halaman {page}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={!hasNext}
          className="px-6 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Selanjutnya
        </button>
      </div>
    </div>
  );
}
