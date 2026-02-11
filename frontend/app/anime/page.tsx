'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FiCalendar } from 'react-icons/fi';
import { AnimeCard, Pagination, CardGridSkeleton } from '@/components';
import { animeApi } from '@/lib/api';
import ContinueWatching from '@/components/shared/ContinueWatching';

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

const STORAGE_KEY = 'anlix_anime_seen';

export default function AnimePage() {
  const [allAnime, setAllAnime] = useState<AnimeItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get seen slugs from sessionStorage
  const getSeenSlugs = useCallback((): Set<string> => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  }, []);

  // Save seen slugs to sessionStorage
  const saveSeenSlugs = useCallback((slugs: Set<string>) => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(slugs)));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Clear seen slugs (for page 1)
  const clearSeenSlugs = useCallback(() => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    const fetchAnime = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await animeApi.getLatest(page);
        const newItems = (data.data || []) as AnimeItem[];
        
        if (page === 1) {
          // Reset on first page
          clearSeenSlugs();
          const seenSlugs = new Set<string>();
          const uniqueItems = newItems.filter(item => {
            if (seenSlugs.has(item.slug)) return false;
            seenSlugs.add(item.slug);
            return true;
          });
          saveSeenSlugs(seenSlugs);
          setAllAnime(uniqueItems);
        } else {
          // Filter duplicates for subsequent pages
          const seenSlugs = getSeenSlugs();
          const uniqueItems = newItems.filter(item => {
            if (seenSlugs.has(item.slug)) return false;
            seenSlugs.add(item.slug);
            return true;
          });
          saveSeenSlugs(seenSlugs);
          setAllAnime(prev => [...prev, ...uniqueItems]);
        }
        
        setHasNext(data.hasNext || false);
      } catch (err: unknown) {
        console.error('Failed to fetch anime:', err);
        if (err && typeof err === 'object' && 'response' in err) {
          const axiosErr = err as { response?: { status?: number } };
          if (axiosErr.response?.status === 429) {
            setError('Terlalu banyak request. Mohon tunggu beberapa saat dan refresh halaman.');
          } else {
            setError('Gagal memuat data. Silakan coba lagi.');
          }
        } else {
          setError('Gagal memuat data. Silakan coba lagi.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnime();
  }, [page, clearSeenSlugs, getSeenSlugs, saveSeenSlugs]);

  // Calculate items for current page view
  const itemsPerPage = 18;
  const startIdx = (page - 1) * itemsPerPage;
  const displayItems = allAnime.slice(startIdx, startIdx + itemsPerPage);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-2">
          Daftar <span className="gradient-text">Anime</span>
        </h1>
        <p className="text-gray-400 mb-4">
          Koleksi anime subtitle Indonesia terlengkap dengan update terbaru
        </p>
        
        {/* Quick Filter Buttons */}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/anime/jadwal"
            className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-yellow-500/30 rounded-lg text-yellow-400 hover:text-yellow-300 hover:border-yellow-500/50 transition-all"
          >
            <FiCalendar className="w-4 h-4" />
            Jadwal Rilis
          </Link>
        </div>
      </div>

      {/* Continue Watching Section */}
      <ContinueWatching contentType="anime" />

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <CardGridSkeleton count={18} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {displayItems.map((item, index) => (
              <AnimeCard
                key={`${item.slug}-${page}-${index}`}
                {...item}
                contentType="anime"
                index={index}
              />
            ))}
          </div>

          {allAnime.length === 0 && !isLoading && !error && (
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
