'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiArrowRight } from 'react-icons/fi';
import { animeApi } from '@/lib/api';
import AnimeCard from '@/components/ui/AnimeCard';
import { CardSkeleton } from '@/components/ui/Skeletons';

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

interface RelatedAnimeProps {
  currentSlug: string;
  genres?: string[];
  title?: string;
}

// Convert genre name to slug format
function genreToSlug(genre: string): string {
  return genre
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export default function RelatedAnime({ currentSlug, genres, title }: RelatedAnimeProps) {
  const [relatedAnimes, setRelatedAnimes] = useState<AnimeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeGenre, setActiveGenre] = useState<string>('');

  useEffect(() => {
    const fetchRelated = async () => {
      if (!genres || genres.length === 0) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      
      // Try fetching from each genre until we get results
      for (const genre of genres) {
        try {
          const genreSlug = genreToSlug(genre);
          const result = await animeApi.getByGenre(genreSlug, 1);
          const items: AnimeItem[] = result.data || [];
          
          // Filter out the current anime and limit to 6
          const filtered = items
            .filter((item: AnimeItem) => item.slug !== currentSlug)
            .slice(0, 6);
          
          if (filtered.length > 0) {
            setRelatedAnimes(filtered);
            setActiveGenre(genre);
            break;
          }
        } catch (err) {
          console.error(`Failed to fetch anime for genre ${genre}:`, err);
          continue;
        }
      }
      
      setIsLoading(false);
    };

    fetchRelated();
  }, [currentSlug, genres]);

  // Don't render if no genres or no results
  if (!isLoading && relatedAnimes.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mt-10"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-display font-bold text-white">
            Anime Terkait
          </h2>
          {activeGenre && (
            <p className="text-sm text-gray-400 mt-1">
              Rekomendasi anime genre <span className="text-primary">{activeGenre}</span>
            </p>
          )}
        </div>
        {activeGenre && (
          <Link
            href={`/anime/genre/${genreToSlug(activeGenre)}`}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            Lihat Semua
            <FiArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Related Anime Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {relatedAnimes.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <AnimeCard
                id={item.id}
                title={item.title}
                slug={item.slug}
                poster={item.poster}
                type={item.type || 'TV'}
                rating={item.rating}
                latestEpisode={item.latestEpisode}
                status={item.status}
                contentType="anime"
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Genre Tags */}
      {genres && genres.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {genres.map((genre) => (
            <Link
              key={genre}
              href={`/anime/genre/${genreToSlug(genre)}`}
              className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                genre === activeGenre
                  ? 'bg-primary/20 border-primary/50 text-primary'
                  : 'bg-dark-card border-white/10 text-gray-400 hover:text-white hover:border-white/30'
              }`}
            >
              {genre}
            </Link>
          ))}
        </div>
      )}
    </motion.div>
  );
}
