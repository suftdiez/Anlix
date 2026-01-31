'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiSearch, FiBook } from 'react-icons/fi';
import { novelApi } from '@/lib/api';

interface Novel {
  id: string;
  title: string;
  slug: string;
  poster: string;
  latestChapter?: string;
  type?: string;
}

export default function KoreaNovelPage() {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  useEffect(() => {
    const fetchNovels = async () => {
      setIsLoading(true);
      try {
        const response = await novelApi.getKorea(page);
        if (response.success) {
          setNovels(response.novels);
          setHasNext(response.hasNext);
        }
      } catch (error) {
        console.error('Error fetching Korean novels:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNovels();
  }, [page]);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Novel Korea</h1>
        <p className="text-gray-400 mb-4">Koleksi web novel Korea terjemahan Indonesia</p>
        
        <Link
          href="/novel/search"
          className="inline-flex items-center gap-2 px-4 py-2 bg-dark-card border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-primary/50 transition-all"
        >
          <FiSearch className="w-4 h-4" />
          Cari Novel
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Link href="/novel" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Terbaru
        </Link>
        <Link href="/novel/popular" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Populer
        </Link>
        <Link href="/novel/china" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          China
        </Link>
        <Link href="/novel/jepang" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Jepang
        </Link>
        <Link href="/novel/korea" className="px-4 py-2 bg-primary text-white rounded-lg font-medium">
          Korea
        </Link>
        <Link href="/novel/tamat" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Tamat
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(18)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] bg-gray-800 rounded-lg mb-2" />
              <div className="h-4 bg-gray-800 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {novels.map((novel) => (
            <Link
              key={novel.id}
              href={`/novel/${novel.slug}`}
              className="group relative bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all"
            >
              <div className="aspect-[3/4] relative overflow-hidden">
                <Image
                  src={novel.poster || '/placeholder-novel.jpg'}
                  alt={novel.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                />
                {novel.type && (
                  <span className={`absolute top-2 left-2 px-2 py-0.5 text-white text-xs font-medium rounded ${
                    novel.type === 'HTL' ? 'bg-green-600' : 'bg-blue-600'
                  }`}>
                    {novel.type}
                  </span>
                )}
                {novel.latestChapter && (
                  <span className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent text-white text-xs">
                    {novel.latestChapter}
                  </span>
                )}
              </div>
              <div className="p-2">
                <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-primary transition">
                  {novel.title}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      )}

      {novels.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <FiBook className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">Tidak ada novel ditemukan</p>
        </div>
      )}

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
