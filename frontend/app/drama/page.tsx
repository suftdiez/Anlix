'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FiHome, FiFilm, FiTrendingUp, FiMic, FiLayers, FiChevronRight, FiPlay, FiLoader } from 'react-icons/fi';
import { dramaApi, dramaboxApi, dramaboxSansekaiApi } from '@/lib/api';
import { CardSkeleton } from '@/components/ui/Skeletons';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface DramaItem {
  id: string;
  title: string;
  poster: string;
  abstract?: string;
  status?: string;
  episodeCount?: number;
  categories?: string[];
  playCount?: string;
  source: 'melolo' | 'dramabox' | 'dramabox-sansekai';
}

type TabType = 'all' | 'dramabox' | 'dramabox-sansekai' | 'melolo';

// Helper to get Melolo image proxy URL - only proxy if not already proxied
function getMeloloImageUrl(url: string): string {
  if (!url) return '';
  // If already a proxied URL (from backend), just add API_URL prefix if needed
  if (url.startsWith('/api/drama/image')) {
    return `${API_URL}${url}`;
  }
  // If already fully proxied with full URL, return as-is
  if (url.includes('/api/drama/image?url=')) {
    return url;
  }
  // Otherwise, wrap in proxy
  return `${API_URL}/api/drama/image?url=${encodeURIComponent(url)}`;
}

export default function DramaPage() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [dramas, setDramas] = useState<DramaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [allDramaboxDramas, setAllDramaboxDramas] = useState<DramaItem[]>([]);
  const [displayCount, setDisplayCount] = useState(30);
  const [hasMore, setHasMore] = useState(true);

  // Fetch dramas on tab change
  useEffect(() => {
    const fetchDramas = async () => {
      setIsLoading(true);
      setDramas([]);
      setDisplayCount(30);
      setHasMore(true);
      
      try {
        let allDramas: DramaItem[] = [];

        switch (activeTab) {
          case 'all':
            // Fetch from ALL THREE APIs and merge
            const [
              meloloLatest, meloloTrending, 
              dbLatest, dbTrending, dbForYou,
              sbLatest, sbTrending, sbDubindo
            ] = await Promise.all([
              dramaApi.getLatest().catch(() => ({ data: [] })),
              dramaApi.getTrending().catch(() => ({ data: [] })),
              dramaboxApi.getLatest().catch(() => ({ data: [] })),
              dramaboxApi.getTrending().catch(() => ({ data: [] })),
              dramaboxApi.getForYou().catch(() => ({ data: [] })),
              dramaboxSansekaiApi.getLatest().catch(() => ({ data: [] })),
              dramaboxSansekaiApi.getTrending().catch(() => ({ data: [] })),
              dramaboxSansekaiApi.getDubindo('terpopuler', 1).catch(() => ({ data: [] })),
            ]);

            // Add Melolo dramas with source tag and proxied images
            const meloloDramas = [...(meloloLatest.data || []), ...(meloloTrending.data || [])].map((d: any) => ({
              ...d,
              poster: getMeloloImageUrl(d.poster),
              source: 'melolo' as const,
            }));

            // Add DramaDash dramas with source tag
            const dramaboxDramas = [
              ...(dbLatest.data || []), 
              ...(dbTrending.data || []),
              ...(dbForYou.data || []),
            ].map((d: any) => ({
              ...d,
              source: 'dramabox' as const,
            }));

            // Add DramaBox Sansekai dramas with source tag
            const sansekaiDramas = [
              ...(sbLatest.data || []),
              ...(sbTrending.data || []),
              ...(sbDubindo.data || []),
            ].map((d: any) => ({
              ...d,
              source: 'dramabox-sansekai' as const,
            }));

            // Save all for "load more"
            setAllDramaboxDramas([...dramaboxDramas, ...sansekaiDramas]);

            // Merge and dedupe by title (sansekai first, then dramabox, then melolo)
            const mergedMap = new Map<string, DramaItem>();
            [...sansekaiDramas, ...dramaboxDramas, ...meloloDramas].forEach(d => {
              if (d.title && !mergedMap.has(d.title)) {
                mergedMap.set(d.title, d);
              }
            });
            allDramas = Array.from(mergedMap.values());
            break;

          case 'dramabox':
            const [latest, trending, forYou] = await Promise.all([
              dramaboxApi.getLatest().catch(() => ({ data: [] })),
              dramaboxApi.getTrending().catch(() => ({ data: [] })),
              dramaboxApi.getForYou().catch(() => ({ data: [] })),
            ]);

            const dbDramas = [
              ...(latest.data || []), 
              ...(trending.data || []),
              ...(forYou.data || []),
            ].map((d: any) => ({
              ...d,
              source: 'dramabox' as const,
            }));

            // Dedupe
            const dbMap = new Map<string, DramaItem>();
            dbDramas.forEach(d => {
              if (d.title && !dbMap.has(d.title)) {
                dbMap.set(d.title, d);
              }
            });
            allDramas = Array.from(dbMap.values());
            setAllDramaboxDramas(allDramas);
            break;

          case 'dramabox-sansekai':
            console.log('[DramaBox-Sansekai] Fetching dramas...');
            const [sbLat, sbTrend, sbDub, sbVip] = await Promise.all([
              dramaboxSansekaiApi.getLatest().catch((e) => { console.error('[DramaBox-Sansekai] latest error:', e); return { data: [] }; }),
              dramaboxSansekaiApi.getTrending().catch((e) => { console.error('[DramaBox-Sansekai] trending error:', e); return { data: [] }; }),
              dramaboxSansekaiApi.getDubindo('terpopuler', 1).catch((e) => { console.error('[DramaBox-Sansekai] dubindo error:', e); return { data: [] }; }),
              dramaboxSansekaiApi.getVip().catch((e) => { console.error('[DramaBox-Sansekai] vip error:', e); return { data: [] }; }),
            ]);

            console.log('[DramaBox-Sansekai] Results:', {
              latest: sbLat?.data?.length || 0,
              trending: sbTrend?.data?.length || 0,
              dubindo: sbDub?.data?.length || 0,
              vip: sbVip?.data?.length || 0,
            });

            const sbDramas = [
              ...(sbLat.data || []),
              ...(sbTrend.data || []),
              ...(sbDub.data || []),
              ...(sbVip.data || []),
            ].map((d: any) => ({
              ...d,
              source: 'dramabox-sansekai' as const,
            }));

            console.log('[DramaBox-Sansekai] Total before dedupe:', sbDramas.length);

            // Dedupe
            const sbMap = new Map<string, DramaItem>();
            sbDramas.forEach(d => {
              if (d.title && !sbMap.has(d.title)) {
                sbMap.set(d.title, d);
              }
            });
            allDramas = Array.from(sbMap.values());
            console.log('[DramaBox-Sansekai] Total after dedupe:', allDramas.length);
            break;

          case 'melolo':
            const [mLatest, mTrending] = await Promise.all([
              dramaApi.getLatest().catch(() => ({ data: [] })),
              dramaApi.getTrending().catch(() => ({ data: [] })),
            ]);

            allDramas = [...(mLatest.data || []), ...(mTrending.data || [])].map((d: any) => ({
              ...d,
              poster: getMeloloImageUrl(d.poster),
              source: 'melolo' as const,
            }));

            // Dedupe
            const meloloMap = new Map<string, DramaItem>();
            allDramas.forEach(d => {
              if (d.title && !meloloMap.has(d.title)) {
                meloloMap.set(d.title, d);
              }
            });
            allDramas = Array.from(meloloMap.values());
            break;
        }

        setDramas(allDramas);
        // Check if there are more dramas to show
        setHasMore(allDramas.length > 30);
      } catch (error) {
        console.error('Failed to fetch dramas:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDramas();
  }, [activeTab]);

  // Load more function - just show more from already loaded dramas
  const loadMore = useCallback(() => {
    if (isLoadingMore) return;
    
    setIsLoadingMore(true);
    
    // Simulate loading delay
    setTimeout(() => {
      const newCount = displayCount + 30;
      setDisplayCount(newCount);
      
      // Check if no more dramas to show
      if (newCount >= dramas.length) {
        setHasMore(false);
      }
      
      setIsLoadingMore(false);
    }, 500);
  }, [displayCount, dramas.length, isLoadingMore]);

  // Get visible dramas based on displayCount
  const visibleDramas = dramas.slice(0, displayCount);

  // Get poster URL - handle missing poster
  const getPosterUrl = (poster: string | undefined) => {
    if (!poster) return '/placeholder-drama.jpg';
    if (poster.startsWith('http')) return poster;
    if (poster.startsWith('/api')) return `${API_URL}${poster}`;
    return poster;
  };

  // Build detail URL with data
  const getDetailUrl = (drama: DramaItem) => {
    if (drama.source === 'melolo') {
      return `/drama/${drama.id}`;
    }
    const params = new URLSearchParams({
      title: drama.title || '',
      poster: drama.poster || '',
      abstract: drama.abstract || '',
      eps: (drama.episodeCount || 0).toString(),
      source: drama.source, // Pass source to detail page
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
          DramaDash
        </button>
        <button
          onClick={() => setActiveTab('dramabox-sansekai')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === 'dramabox-sansekai'
              ? 'bg-orange-500 text-white'
              : 'bg-dark-card text-gray-400 hover:text-white'
          }`}
        >
          <FiFilm className="w-4 h-4" />
          DramaBox
        </button>
        <button
          onClick={() => setActiveTab('melolo')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === 'melolo'
              ? 'bg-purple-500 text-white'
              : 'bg-dark-card text-gray-400 hover:text-white'
          }`}
        >
          <FiMic className="w-4 h-4" />
          Melolo ({activeTab === 'melolo' ? dramas.length : '...'})
        </button>
      </div>

      {/* Drama Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(18)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : visibleDramas.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {visibleDramas.map((drama, index) => (
              <motion.div
                key={`${drama.source}-${drama.id}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.5) }}
              >
                <Link href={getDetailUrl(drama)}>
                  <div className="group relative rounded-xl overflow-hidden bg-dark-card border border-white/5 hover:border-pink-500/50 transition-all">
                    {/* Poster - Portrait aspect ratio for drama */}
                    <div className="relative aspect-[2/3]">
                      {drama.poster ? (
                        <Image
                          src={getPosterUrl(drama.poster)}
                          alt={drama.title || 'Drama'}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                          unoptimized
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-900/50 to-purple-900/50 flex items-center justify-center">
                          <FiFilm className="w-12 h-12 text-pink-500/50" />
                        </div>
                      )}
                      {/* Source badge */}
                      <div className={`absolute top-2 left-2 px-2 py-1 text-white text-xs rounded-md font-medium ${
                        drama.source === 'melolo' 
                          ? 'bg-purple-500/90' 
                          : drama.source === 'dramabox-sansekai' 
                            ? 'bg-orange-500/90' 
                            : 'bg-pink-500/90'
                      }`}>
                        {drama.source === 'melolo' 
                          ? 'Melolo' 
                          : drama.source === 'dramabox-sansekai' 
                            ? 'DramaBox' 
                            : 'DramaDash'}
                      </div>
                      {/* Episode badge */}
                      {drama.episodeCount && drama.episodeCount > 0 && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded-md font-medium">
                          {drama.episodeCount} Eps
                        </div>
                      )}
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
                        {drama.title || 'Untitled'}
                      </h3>
                      {drama.categories && drama.categories.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                          {Array.isArray(drama.categories) 
                            ? drama.categories.slice(0, 3).join(', ')
                            : drama.categories}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && displayCount < dramas.length && (
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
                    Muat Lebih Banyak ({dramas.length - displayCount} tersisa)
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
