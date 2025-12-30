'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiSearch } from 'react-icons/fi';
import { AnimeCard, Pagination, CardGridSkeleton } from '@/components';
import { animeApi, donghuaApi } from '@/lib/api';

interface ContentItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  type?: string;
  rating?: string;
  latestEpisode?: string;
  status?: string;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [animeResults, setAnimeResults] = useState<ContentItem[]>([]);
  const [donghuaResults, setDonghuaResults] = useState<ContentItem[]>([]);
  const [animePage, setAnimePage] = useState(1);
  const [donghuaPage, setDonghuaPage] = useState(1);
  const [animeHasNext, setAnimeHasNext] = useState(false);
  const [donghuaHasNext, setDonghuaHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'anime' | 'donghua'>('anime');

  useEffect(() => {
    if (!query) return;

    const search = async () => {
      setIsLoading(true);
      try {
        const [animeData, donghuaData] = await Promise.all([
          animeApi.search(query, animePage),
          donghuaApi.search(query, donghuaPage),
        ]);

        setAnimeResults(animeData.data || []);
        setAnimeHasNext(animeData.hasNext || false);
        setDonghuaResults(donghuaData.data || []);
        setDonghuaHasNext(donghuaData.hasNext || false);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    search();
  }, [query, animePage, donghuaPage]);

  const currentResults = activeTab === 'anime' ? animeResults : donghuaResults;
  const currentHasNext = activeTab === 'anime' ? animeHasNext : donghuaHasNext;
  const currentPage = activeTab === 'anime' ? animePage : donghuaPage;
  const setCurrentPage = activeTab === 'anime' ? setAnimePage : setDonghuaPage;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-2">
          Hasil Pencarian
        </h1>
        {query && (
          <p className="text-gray-400 flex items-center gap-2">
            <FiSearch className="w-4 h-4" />
            <span>Menampilkan hasil untuk: </span>
            <span className="text-primary font-medium">"{query}"</span>
          </p>
        )}
      </div>

      {!query ? (
        <div className="text-center py-20">
          <FiSearch className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <h2 className="text-xl text-gray-400">Masukkan kata kunci untuk mencari</h2>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => setActiveTab('anime')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'anime'
                  ? 'bg-primary text-white'
                  : 'bg-dark-card text-gray-400 hover:text-white'
              }`}
            >
              Anime ({animeResults.length})
            </button>
            <button
              onClick={() => setActiveTab('donghua')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'donghua'
                  ? 'bg-accent text-dark'
                  : 'bg-dark-card text-gray-400 hover:text-white'
              }`}
            >
              Donghua ({donghuaResults.length})
            </button>
          </div>

          {/* Results */}
          {isLoading ? (
            <CardGridSkeleton count={12} />
          ) : currentResults.length > 0 ? (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {currentResults.map((item, index) => (
                  <AnimeCard key={item.id} {...item} contentType={activeTab} index={index} />
                ))}
              </div>

              <Pagination
                currentPage={currentPage}
                hasNext={currentHasNext}
                onPageChange={setCurrentPage}
                isLoading={isLoading}
              />
            </motion.div>
          ) : (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg">
                Tidak ada {activeTab} ditemukan untuk "{query}"
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8"><CardGridSkeleton count={12} /></div>}>
      <SearchContent />
    </Suspense>
  );
}
