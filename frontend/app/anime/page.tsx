'use client';

import { useEffect, useState } from 'react';
import { AnimeCard, Pagination, CardGridSkeleton } from '@/components';
import { animeApi } from '@/lib/api';

interface AnimeItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  type?: string;
  rating?: string;
  latestEpisode?: string;
  status?: string;
}

export default function AnimePage() {
  const [anime, setAnime] = useState<AnimeItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnime = async () => {
      setIsLoading(true);
      try {
        const data = await animeApi.getLatest(page);
        setAnime(data.data || []);
        setHasNext(data.hasNext || false);
      } catch (error) {
        console.error('Failed to fetch anime:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnime();
  }, [page]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-2">
          Daftar <span className="gradient-text">Anime</span>
        </h1>
        <p className="text-gray-400">
          Koleksi anime subtitle Indonesia terlengkap dengan update terbaru
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <CardGridSkeleton count={18} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {anime.map((item, index) => (
              <AnimeCard
                key={item.id}
                {...item}
                contentType="anime"
                index={index}
              />
            ))}
          </div>

          {anime.length === 0 && !isLoading && (
            <div className="text-center py-20 text-gray-500">
              Tidak ada anime ditemukan
            </div>
          )}

          <Pagination
            currentPage={page}
            hasNext={hasNext}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        </>
      )}
    </div>
  );
}
