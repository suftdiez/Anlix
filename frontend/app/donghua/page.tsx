'use client';

import { useEffect, useState } from 'react';
import { AnimeCard, Pagination, CardGridSkeleton } from '@/components';
import { donghuaApi } from '@/lib/api';

interface DonghuaItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  type?: string;
  rating?: string;
  latestEpisode?: string;
  status?: string;
}

export default function DonghuaPage() {
  const [donghua, setDonghua] = useState<DonghuaItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDonghua = async () => {
      setIsLoading(true);
      try {
        const data = await donghuaApi.getLatest(page);
        setDonghua(data.data || []);
        setHasNext(data.hasNext || false);
      } catch (error) {
        console.error('Failed to fetch donghua:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDonghua();
  }, [page]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-2">
          Daftar <span className="gradient-text">Donghua</span>
        </h1>
        <p className="text-gray-400">
          Koleksi donghua (anime China) subtitle Indonesia terlengkap
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <CardGridSkeleton count={18} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {donghua.map((item, index) => (
              <AnimeCard
                key={item.id}
                {...item}
                contentType="donghua"
                index={index}
              />
            ))}
          </div>

          {donghua.length === 0 && !isLoading && (
            <div className="text-center py-20 text-gray-500">
              Tidak ada donghua ditemukan
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
