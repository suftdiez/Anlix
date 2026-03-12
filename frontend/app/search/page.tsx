'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FiSearch, FiPlay } from 'react-icons/fi';
import { AnimeCard, Pagination, CardGridSkeleton } from '@/components';
import { animeApi, donghuaApi, dramaboxApi, rebahinApi, filmApi, komikApi, novelApi } from '@/lib/api';

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

interface FilmItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  year?: string;
  quality?: string;
  rating?: string;
  duration?: string;
  type?: string;
}

interface KomikItem {
  title: string;
  slug: string;
  poster: string;
  type?: string;
  latestChapter?: string;
  rating?: string;
}

interface NovelItem {
  title: string;
  slug: string;
  poster: string;
  type?: string;
  latestChapter?: string;
  status?: string;
  rating?: string;
}

type TabType = 'anime' | 'donghua' | 'drama' | 'film' | 'komik' | 'novel';

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [animeResults, setAnimeResults] = useState<ContentItem[]>([]);
  const [donghuaResults, setDonghuaResults] = useState<ContentItem[]>([]);
  const [dramaResults, setDramaResults] = useState<DramaItem[]>([]);
  const [filmResults, setFilmResults] = useState<FilmItem[]>([]);
  const [komikResults, setKomikResults] = useState<KomikItem[]>([]);
  const [novelResults, setNovelResults] = useState<NovelItem[]>([]);
  const [animePage, setAnimePage] = useState(1);
  const [donghuaPage, setDonghuaPage] = useState(1);
  const [animeHasNext, setAnimeHasNext] = useState(false);
  const [donghuaHasNext, setDonghuaHasNext] = useState(false);
  const [filmHasNext, setFilmHasNext] = useState(false);
  const [filmPage, setFilmPage] = useState(1);
  const [novelHasNext, setNovelHasNext] = useState(false);
  const [novelPage, setNovelPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('anime');

  useEffect(() => {
    if (!query) return;

    const search = async () => {
      setIsLoading(true);
      try {
        const [animeData, donghuaData, dramaData, rebahinData, filmData, komikData, novelData] = await Promise.all([
          animeApi.search(query, animePage),
          donghuaApi.search(query, donghuaPage),
          dramaboxApi.search(query).catch(() => ({ data: [] })),
          rebahinApi.search(query).catch(() => ({ data: [] })),
          filmApi.search(query, filmPage).catch(() => ({ data: [] })),
          komikApi.search(query).catch(() => ({ data: [] })),
          novelApi.search(query, novelPage).catch(() => ({ novels: [], hasNext: false })),
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

        // Film results
        setFilmResults(filmData.data || []);
        setFilmHasNext(filmData.hasNext || false);

        // Komik results
        setKomikResults(komikData.data || []);

        // Novel results
        setNovelResults(novelData.novels || novelData.data || []);
        setNovelHasNext(novelData.hasNext || false);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    search();
  }, [query, animePage, donghuaPage, filmPage, novelPage]);

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

  const tabs: { key: TabType; label: string; count: number; color: string; activeTextColor: string }[] = [
    { key: 'anime', label: 'Anime', count: animeResults.length, color: 'bg-primary', activeTextColor: 'text-white' },
    { key: 'donghua', label: 'Donghua', count: donghuaResults.length, color: 'bg-accent', activeTextColor: 'text-dark' },
    { key: 'drama', label: 'Drama', count: dramaResults.length, color: 'bg-pink-500', activeTextColor: 'text-white' },
    { key: 'film', label: 'Film', count: filmResults.length, color: 'bg-blue-500', activeTextColor: 'text-white' },
    { key: 'komik', label: 'Komik', count: komikResults.length, color: 'bg-orange-500', activeTextColor: 'text-white' },
    { key: 'novel', label: 'Novel', count: novelResults.length, color: 'bg-purple-500', activeTextColor: 'text-white' },
  ];

  // Generic card grid for Film, Komik, Novel
  const renderGenericGrid = (items: any[], type: 'film' | 'komik' | 'novel') => {
    if (items.length === 0) {
      return (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">
            Tidak ada {type} ditemukan untuk &quot;{query}&quot;
          </p>
        </div>
      );
    }

    const getLink = (item: any) => {
      if (type === 'film') return `/film/${item.slug}`;
      if (type === 'komik') return `/komik/${item.slug}`;
      if (type === 'novel') return `/novel/${item.slug}`;
      return '#';
    };

    const getBadge = (item: any) => {
      if (type === 'film') {
        return item.quality || item.year || null;
      }
      if (type === 'komik') {
        return item.type || item.latestChapter || null;
      }
      if (type === 'novel') {
        return item.status || item.type || null;
      }
      return null;
    };

    const getBadgeColor = () => {
      if (type === 'film') return 'bg-blue-500/90';
      if (type === 'komik') return 'bg-orange-500/90';
      return 'bg-purple-500/90';
    };

    const getSubtext = (item: any) => {
      if (type === 'film') return item.duration || item.rating || '';
      if (type === 'komik') return item.latestChapter || '';
      if (type === 'novel') return item.latestChapter || '';
      return '';
    };

    return (
      <motion.div
        key={type}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((item: any, index: number) => (
            <motion.div
              key={item.slug || item.id || index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.05, 0.5) }}
            >
              <Link href={getLink(item)}>
                <div className="group relative rounded-xl overflow-hidden bg-dark-card border border-white/5 hover:border-white/20 transition-all">
                  {/* Poster */}
                  <div className="relative aspect-[2/3]">
                    <Image
                      src={item.poster || '/placeholder.png'}
                      alt={item.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                    />
                    {/* Badge */}
                    {getBadge(item) && (
                      <div className={`absolute top-2 left-2 px-2 py-1 ${getBadgeColor()} text-white text-xs rounded-md font-medium`}>
                        {getBadge(item)}
                      </div>
                    )}
                    {/* Rating */}
                    {item.rating && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500/90 text-dark text-xs rounded-md font-bold">
                        ⭐ {item.rating}
                      </div>
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  </div>
                  
                  {/* Title */}
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    {getSubtext(item) && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                        {getSubtext(item)}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Pagination for film and novel */}
        {type === 'film' && (
          <Pagination
            currentPage={filmPage}
            hasNext={filmHasNext}
            onPageChange={setFilmPage}
            isLoading={isLoading}
          />
        )}
        {type === 'novel' && (
          <Pagination
            currentPage={novelPage}
            hasNext={novelHasNext}
            onPageChange={setNovelPage}
            isLoading={isLoading}
          />
        )}
      </motion.div>
    );
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
            <span className="text-primary font-medium">&quot;{query}&quot;</span>
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
          <div className="flex gap-3 mb-8 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${
                  activeTab === tab.key
                    ? `${tab.color} ${tab.activeTextColor}`
                    : 'bg-dark-card text-gray-400 hover:text-white'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
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
                  Tidak ada drama ditemukan untuk &quot;{query}&quot;
                </p>
              </div>
            )
          ) : activeTab === 'film' ? (
            renderGenericGrid(filmResults, 'film')
          ) : activeTab === 'komik' ? (
            renderGenericGrid(komikResults, 'komik')
          ) : activeTab === 'novel' ? (
            renderGenericGrid(novelResults, 'novel')
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
                Tidak ada {activeTab} ditemukan untuk &quot;{query}&quot;
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
