'use client';

import { useEffect, useState, useRef } from 'react';
import { FiChevronLeft, FiChevronRight, FiTrendingUp } from 'react-icons/fi';
import { AnimeCard } from '@/components';
import { filmApi } from '@/lib/api';

interface FilmItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  year?: string;
  rating?: string;
  quality?: string;
}

export default function PopularFilms() {
  const [films, setFilms] = useState<FilmItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPopularFilms = async () => {
      try {
        setIsLoading(true);
        const data = await filmApi.getPopularFilms();
        setFilms((data.data || []).slice(0, 12));
        setError(null);
      } catch (err) {
        console.error('Failed to fetch popular films:', err);
        setError('Gagal memuat film populer');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPopularFilms();
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Don't render if error or no films
  if (error || (!isLoading && films.length === 0)) {
    return null;
  }

  return (
    <section className="mb-10">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-lg">
            <FiTrendingUp className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-display font-bold text-white">
              Terpopuler
            </h2>
            <p className="text-sm text-gray-400">
              Film paling populer saat ini
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Scroll Buttons */}
          <button
            onClick={() => scroll('left')}
            className="p-2 bg-dark-card border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-orange-500/50 transition-all"
            aria-label="Scroll left"
          >
            <FiChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-2 bg-dark-card border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-orange-500/50 transition-all"
            aria-label="Scroll right"
          >
            <FiChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Film Cards */}
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {isLoading ? (
            // Loading Skeleton
            Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="flex-shrink-0 w-[160px] md:w-[180px]"
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className="aspect-[2/3] bg-dark-card rounded-lg animate-pulse" />
                <div className="mt-2 h-4 bg-dark-card rounded animate-pulse w-3/4" />
                <div className="mt-1 h-3 bg-dark-card rounded animate-pulse w-1/2" />
              </div>
            ))
          ) : (
            films.map((item, index) => (
              <div
                key={item.id}
                className="flex-shrink-0 w-[160px] md:w-[180px]"
                style={{ scrollSnapAlign: 'start' }}
              >
                <AnimeCard
                  id={item.id}
                  title={item.title}
                  slug={item.slug}
                  poster={item.poster}
                  rating={item.rating}
                  type={item.quality || 'HD'}
                  contentType="film"
                  index={index}
                />
              </div>
            ))
          )}
        </div>

        {/* Gradient fade edges */}
        <div className="absolute left-0 top-0 bottom-2 w-8 bg-gradient-to-r from-dark-bg to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-dark-bg to-transparent pointer-events-none" />
      </div>
    </section>
  );
}
