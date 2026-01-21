'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FiHome, FiFilm, FiTrendingUp, FiMic, FiLayers, FiChevronLeft, FiChevronRight, FiPlay, FiLoader } from 'react-icons/fi';
import { dramaboxApi, dramaApi } from '@/lib/api';
import { CardSkeleton } from '@/components/ui/Skeletons';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Helper to get full image URL for Melolo (uses proxy)
function getMeloloImageUrl(posterPath: string): string {
  if (!posterPath) return '/placeholder.jpg';
  if (posterPath.startsWith('http')) return posterPath;
  return `${API_URL}${posterPath}`;
}

interface DramaItem {
  id: string;
  title: string;
  poster: string;
  abstract: string;
  status: string;
  episodeCount: number;
  categories: string[];
  playCount?: string;
  source: 'melolo' | 'dramabox';
}

type TabType = 'all' | 'dramabox' | 'dubbed';

export default function DramaPage() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [dramas, setDramas] = useState<DramaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Initial load
  useEffect(() => {
    const fetchDramas = async () => {
      setIsLoading(true);
      setDramas([]);
      setCurrentPage(1);
      setHasMore(true);
      
      try {
        let allDramas: DramaItem[] = [];

        switch (activeTab) {
          case 'all':
            // Fetch from BOTH APIs and merge - load more pages for better content quantity
            const [
              meloloLatest, 
              meloloTrending, 
              dramaboxLatest, 
              dramaboxTrending,
              dramaboxForYou,
              dubbedPopular1,
              dubbedPopular2,
              dubbedPopular3,
              dubbedNew1,
              dubbedNew2,
              dubbedNew3,
            ] = await Promise.all([
              dramaApi.getLatest().catch(() => ({ data: [] })),
              dramaApi.getTrending().catch(() => ({ data: [] })),
              dramaboxApi.getLatest().catch(() => ({ data: [] })),
              dramaboxApi.getTrending().catch(() => ({ data: [] })),
              dramaboxApi.getForYou().catch(() => ({ data: [] })),
              dramaboxApi.getDubbed('terpopuler', 1).catch(() => ({ data: [] })),
              dramaboxApi.getDubbed('terpopuler', 2).catch(() => ({ data: [] })),
              dramaboxApi.getDubbed('terpopuler', 3).catch(() => ({ data: [] })),
              dramaboxApi.getDubbed('terbaru', 1).catch(() => ({ data: [] })),
              dramaboxApi.getDubbed('terbaru', 2).catch(() => ({ data: [] })),
              dramaboxApi.getDubbed('terbaru', 3).catch(() => ({ data: [] })),
            ]);

            // Add Melolo dramas with source tag
            const meloloDramas = [...(meloloLatest.data || []), ...(meloloTrending.data || [])].map((d: any) => ({
              ...d,
              poster: getMeloloImageUrl(d.poster),
              source: 'melolo' as const,
            }));

            // Add DramaBox dramas with source tag
            const dramaboxDramas = [
              ...(dramaboxLatest.data || []), 
              ...(dramaboxTrending.data || []),
              ...(dramaboxForYou.data || []),
              ...(dubbedPopular1.data || []),
              ...(dubbedPopular2.data || []),
              ...(dubbedPopular3.data || []),
              ...(dubbedNew1.data || []),
              ...(dubbedNew2.data || []),
              ...(dubbedNew3.data || []),
            ].map((d: any) => ({
              ...d,
              source: 'dramabox' as const,
            }));

            // Merge and dedupe by title
            const mergedMap = new Map<string, DramaItem>();
            [...dramaboxDramas, ...meloloDramas].forEach(d => {
              if (!mergedMap.has(d.title)) {
                mergedMap.set(d.title, d);
              }
            });
            allDramas = Array.from(mergedMap.values());
            setCurrentPage(3); // Next load will be page 4
            break;

          case 'dramabox':
            const [dbLatest, dbTrending, dbForYou, dbDubbed1, dbDubbed2, dbDubbed3] = await Promise.all([
              dramaboxApi.getLatest().catch(() => ({ data: [] })),
              dramaboxApi.getTrending().catch(() => ({ data: [] })),
              dramaboxApi.getForYou().catch(() => ({ data: [] })),
              dramaboxApi.getDubbed('terpopuler', 1).catch(() => ({ data: [] })),
              dramaboxApi.getDubbed('terpopuler', 2).catch(() => ({ data: [] })),
              dramaboxApi.getDubbed('terpopuler', 3).catch(() => ({ data: [] })),
            ]);
            const dbMap = new Map<string, DramaItem>();
            [
              ...(dbLatest.data || []), 
              ...(dbTrending.data || []),
              ...(dbForYou.data || []),
              ...(dbDubbed1.data || []),
              ...(dbDubbed2.data || []),
              ...(dbDubbed3.data || []),
            ].forEach((d: any) => {
              if (!dbMap.has(d.title)) {
                dbMap.set(d.title, { ...d, source: 'dramabox' as const });
              }
            });
            allDramas = Array.from(dbMap.values());
            setCurrentPage(3);
            break;

          case 'dubbed':
            const dubbedResult = await dramaboxApi.getDubbed('terpopuler', 1);
            allDramas = (dubbedResult.data || []).map((d: any) => ({
              ...d,
              source: 'dramabox' as const,
            }));
            setCurrentPage(1);
            break;
        }

        setDramas(allDramas);
      } catch (error) {
        console.error('Failed to fetch dramas:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDramas();
  }, [activeTab]);

  // Load more function
  const loadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    try {
      let newDramas: DramaItem[] = [];
      const nextPage = currentPage + 1;

      switch (activeTab) {
        case 'all':
        case 'dramabox':
          // Load more from dubbed endpoint with pagination
          const [dubbedPopular, dubbedNew] = await Promise.all([
            dramaboxApi.getDubbed('terpopuler', nextPage).catch(() => ({ data: [] })),
            dramaboxApi.getDubbed('terbaru', nextPage).catch(() => ({ data: [] })),
          ]);
          
          const combined = [...(dubbedPopular.data || []), ...(dubbedNew.data || [])];
          if (combined.length === 0) {
            setHasMore(false);
          } else {
            // Filter out duplicates
            const existingTitles = new Set(dramas.map(d => d.title));
            newDramas = combined
              .filter((d: any) => !existingTitles.has(d.title))
              .map((d: any) => ({
                ...d,
                source: 'dramabox' as const,
              }));
          }
          break;

        case 'dubbed':
          const dubbedResult = await dramaboxApi.getDubbed('terpopuler', nextPage);
          const dubbedData = dubbedResult.data || [];
          if (dubbedData.length === 0) {
            setHasMore(false);
          } else {
            const existingIds = new Set(dramas.map(d => d.id));
            newDramas = dubbedData
              .filter((d: any) => !existingIds.has(d.id))
              .map((d: any) => ({
                ...d,
                source: 'dramabox' as const,
              }));
          }
          break;
      }

      if (newDramas.length > 0) {
        setDramas(prev => [...prev, ...newDramas]);
        setCurrentPage(nextPage);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load more:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Build detail URL with data
  const getDetailUrl = (drama: DramaItem) => {
    if (drama.source === 'melolo') {
      return `/drama/${drama.id}`;
    }
    // For DramaBox, pass data via URL params
    const params = new URLSearchParams({
      title: drama.title,
      poster: drama.poster,
      abstract: drama.abstract || '',
      eps: drama.episodeCount.toString(),
    });
    return `/drama/dramabox/${drama.id}?${params.toString()}`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-white transition-colors">
          <FiHome className="w-4 h-4" />
        </Link>
        <span>/</span>
        <span className="text-pink-400">Drama Pendek</span>
      </nav>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-6"
      >
        <FiFilm className="w-6 h-6 text-pink-400" />
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white">
          Drama Pendek
        </h1>
      </motion.div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === 'all'
              ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
              : 'bg-dark-card text-gray-400 hover:text-white'
          }`}
        >
          <FiLayers className="w-4 h-4" />
          Semua ({dramas.length})
        </button>
        <button
          onClick={() => setActiveTab('dramabox')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === 'dramabox'
              ? 'bg-pink-500 text-white'
              : 'bg-dark-card text-gray-400 hover:text-white'
          }`}
        >
          <FiTrendingUp className="w-4 h-4" />
          DramaBox
        </button>
        <button
          onClick={() => setActiveTab('dubbed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === 'dubbed'
              ? 'bg-purple-500 text-white'
              : 'bg-dark-card text-gray-400 hover:text-white'
          }`}
        >
          <FiMic className="w-4 h-4" />
          Sulih Suara
        </button>
      </div>

      {/* Drama Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(18)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : dramas.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {dramas.map((drama, index) => (
              <motion.div
                key={`${drama.source}-${drama.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.5) }}
              >
                <Link href={getDetailUrl(drama)}>
                  <div className="group relative rounded-xl overflow-hidden bg-dark-card border border-white/5 hover:border-pink-500/50 transition-all">
                    {/* Poster - Portrait aspect ratio for drama */}
                    <div className="relative aspect-[2/3]">
                      <Image
                        src={drama.poster}
                        alt={drama.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                      />
                      {/* Episode badge */}
                      <div className="absolute top-2 right-2 px-2 py-1 bg-pink-500/90 text-white text-xs rounded-md font-medium">
                        {drama.episodeCount} Eps
                      </div>
                      {/* Play count */}
                      {drama.playCount && (
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 bg-black/70 text-white text-xs rounded-md">
                          <FiPlay className="w-3 h-3" />
                          {drama.playCount}
                        </div>
                      )}
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

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={loadMore}
                disabled={isLoadingMore}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingMore ? (
                  <>
                    <FiLoader className="w-5 h-5 animate-spin" />
                    Memuat...
                  </>
                ) : (
                  <>
                    <FiChevronRight className="w-5 h-5" />
                    Muat Lebih Banyak
                  </>
                )}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <FiFilm className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">Tidak ada drama ditemukan</p>
        </div>
      )}
    </div>
  );
}
