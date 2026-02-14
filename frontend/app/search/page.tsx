'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FiSearch, FiPlay } from 'react-icons/fi';
import { AnimeCard, Pagination, CardGridSkeleton } from '@/components';
import { animeApi, donghuaApi, dramaboxApi, rebahinApi } from '@/lib/api';

interface ContentItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  type?: string;
  rating?: string;
  latestEpisode?: string;
  status?: string;
  source?: 'samehadaku' | 'otakudesu' | 'kuramanime';
}

interface DramaItem {
  id: string;
  title: string;
  poster: string;
  abstract?: string;
  episodeCount?: number;
  categories?: string[];
  source?: 'dramabox' | 'rebahin';
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [animeResults, setAnimeResults] = useState<ContentItem[]>([]);
  const [donghuaResults, setDonghuaResults] = useState<ContentItem[]>([]);
  const [dramaResults, setDramaResults] = useState<DramaItem[]>([]);
  const [animePage, setAnimePage] = useState(1);
  const [donghuaPage, setDonghuaPage] = useState(1);
  const [animeHasNext, setAnimeHasNext] = useState(false);
  const [donghuaHasNext, setDonghuaHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'anime' | 'donghua' | 'drama'>('anime');

  useEffect(() => {
    if (!query) return;

    const search = async () => {
      setIsLoading(true);
      try {
        const [animeData, donghuaData, dramaData, rebahinData] = await Promise.all([
          animeApi.search(query, animePage),
          donghuaApi.search(query, donghuaPage),
          dramaboxApi.search(query).catch(() => ({ data: [] })),
          rebahinApi.search(query).catch(() => ({ data: [] })),
        ]);

        setAnimeResults(animeData.data || []);
        setAnimeHasNext(animeData.hasNext || false);
        setDonghuaResults(donghuaData.data || []);
        setDonghuaHasNext(donghuaData.hasNext || false);
        
        // Merge DramaBox + Rebahin results
        const dramaboxResults = (dramaData.data || []).map((d: any) => ({ ...d, source: 'dramabox' as const }));
        const rebahinResults = (rebahinData.data || []).map((d: any) => ({
          id: d.id || d.slug,
          title: d.title || '',
          poster: d.poster || '',
          source: 'rebahin' as const,
        }));
        setDramaResults([...dramaboxResults, ...rebahinResults]);
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

  // Build drama detail URL with data
  const getDramaDetailUrl = (drama: DramaItem) => {
    if (drama.source === 'rebahin') {
      return `/drama/rebahin/${drama.id}`;
    }
    const params = new URLSearchParams({
      title: drama.title,
      poster: drama.poster,
      abstract: drama.abstract || '',
      eps: (drama.episodeCount || 0).toString(),
    });
    return `/drama/dramabox/${drama.id}?${params.toString()}`;
  };

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
          <div className="flex gap-4 mb-8 flex-wrap">
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
            <button
              onClick={() => setActiveTab('drama')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'drama'
                  ? 'bg-pink-500 text-white'
                  : 'bg-dark-card text-gray-400 hover:text-white'
              }`}
            >
              Drama ({dramaResults.length})
            </button>
          </div>

          {/* Results */}
          {isLoading ? (
            <CardGridSkeleton count={12} />
          ) : activeTab === 'drama' ? (
            // Drama Results
            dramaResults.length > 0 ? (
              <motion.div
                key="drama"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {dramaResults.map((drama, index) => (
                    <motion.div
                      key={drama.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.05, 0.5) }}
                    >
                      <Link href={getDramaDetailUrl(drama)}>
                        <div className="group relative rounded-xl overflow-hidden bg-dark-card border border-white/5 hover:border-pink-500/50 transition-all">
                          {/* Poster */}
                          <div className="relative aspect-[2/3]">
                            <Image
                              src={drama.poster}
                              alt={drama.title}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                            />
                            {/* Source badge */}
                            {drama.source === 'rebahin' ? (
                              <div className="absolute top-2 left-2 px-2 py-1 bg-teal-500/90 text-white text-xs rounded-md font-medium">
                                Rebahin
                              </div>
                            ) : drama.episodeCount && drama.episodeCount > 0 ? (
                              <div className="absolute top-2 right-2 px-2 py-1 bg-pink-500/90 text-white text-xs rounded-md font-medium">
                                {drama.episodeCount} Eps
                              </div>
                            ) : null}
                            {/* Gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                          </div>
                          
                          {/* Title */}
                          <div className="p-3">
                            <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-pink-400 transition-colors">
                              {drama.title}
                            </h3>
                            {drama.categories && drama.categories.length > 0 && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                {drama.categories.join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="text-center py-20">
                <p className="text-gray-500 text-lg">
                  Tidak ada drama ditemukan untuk "{query}"
                </p>
              </div>
            )
          ) : currentResults.length > 0 ? (
            // Anime/Donghua Results
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
