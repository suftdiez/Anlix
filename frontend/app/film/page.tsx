'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FiSearch, FiGrid } from 'react-icons/fi';
import { AnimeCard, Pagination, CardGridSkeleton } from '@/components';
import { filmApi } from '@/lib/api';

interface FilmItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  year?: string;
  rating?: string;
  quality?: string;
  duration?: string;
  genres?: string[];
}

const STORAGE_KEY = 'anlix_film_seen';

export default function FilmPage() {
  const [allFilms, setAllFilms] = useState<FilmItem[]>([]);
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
    const fetchFilms = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Use trending for page 1 (homepage data works better)
        // Use latest for subsequent pages
        let data;
        if (page === 1) {
          data = await filmApi.getTrending();
        } else {
          data = await filmApi.getLatest(page);
        }
        
        const newItems = (data.data || []) as FilmItem[];
        
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
          setAllFilms(uniqueItems);
        } else {
          // Filter duplicates for subsequent pages
          const seenSlugs = getSeenSlugs();
          const uniqueItems = newItems.filter(item => {
            if (seenSlugs.has(item.slug)) return false;
            seenSlugs.add(item.slug);
            return true;
          });
          saveSeenSlugs(seenSlugs);
          setAllFilms(prev => [...prev, ...uniqueItems]);
        }
        
        setHasNext(data.hasNext || false);
      } catch (err: unknown) {
        console.error('Failed to fetch films:', err);
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

    fetchFilms();
  }, [page, clearSeenSlugs, getSeenSlugs, saveSeenSlugs]);

  // Calculate items for current page view
  const itemsPerPage = 18;
  const startIdx = (page - 1) * itemsPerPage;
  const displayItems = allFilms.slice(startIdx, startIdx + itemsPerPage);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-2">
          Daftar <span className="gradient-text">Film</span>
        </h1>
        <p className="text-gray-400 mb-4">
          Koleksi film subtitle Indonesia terbaru dengan kualitas HD
        </p>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/film/search"
            className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-primary/50 transition-all"
          >
            <FiSearch className="w-4 h-4" />
            Cari Film
          </Link>
          <Link
            href="/film/genre"
            className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-primary/50 transition-all"
          >
            <FiGrid className="w-4 h-4" />
            Lihat Genre
          </Link>
        </div>
      </div>

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
                id={item.id}
                title={item.title}
                slug={item.slug}
                poster={item.poster}
                rating={item.rating}
                type={item.quality || 'HD'}
                contentType="film"
                index={index}
              />
            ))}
          </div>

          {allFilms.length === 0 && !isLoading && !error && (
            <div className="text-center py-20 text-gray-500">
              Tidak ada film ditemukan
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
