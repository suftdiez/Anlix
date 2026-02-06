'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FiGrid, FiChevronRight } from 'react-icons/fi';
import { donghuaApi } from '@/lib/api';
import { getImageUrl } from '@/lib/utils';

interface DonghuaItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  type?: string;
  rating?: string;
  status?: string;
}

interface SimilarDonghuaProps {
  currentSlug: string;
  genres: string[];
  maxItems?: number;
}

export default function SimilarDonghua({ 
  currentSlug, 
  genres, 
  maxItems = 6 
}: SimilarDonghuaProps) {
  const [items, setItems] = useState<DonghuaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [primaryGenre, setPrimaryGenre] = useState<string>('');

  useEffect(() => {
    const fetchSimilar = async () => {
      if (!genres || genres.length === 0) {
        setIsLoading(false);
        return;
      }

      // Use first genre as primary for recommendations
      const genre = genres[0];
      setPrimaryGenre(genre);

      try {
        const result = await donghuaApi.getByGenre(genre.toLowerCase(), 1);
        const data = result.data || [];
        
        // Filter out current donghua and limit results
        const filtered = data
          .filter((item: DonghuaItem) => item.slug !== currentSlug)
          .slice(0, maxItems);
        
        setItems(filtered);
      } catch (err) {
        console.error('Failed to fetch similar donghua:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSimilar();
  }, [currentSlug, genres, maxItems]);

  if (isLoading) {
    return (
      <div className="mt-12">
        <div className="skeleton h-8 w-48 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-poster bg-gray-700 rounded-xl mb-2" />
              <div className="h-4 bg-gray-700 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return null; // Don't show section if no similar items
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mt-12"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-title flex items-center gap-3">
          <span className="w-1 h-8 bg-gradient-to-b from-accent to-primary rounded-full" />
          <FiGrid className="w-5 h-5 text-accent" />
          Donghua Serupa
        </h2>
        {primaryGenre && (
          <Link
            href={`/donghua/genre/${primaryGenre.toLowerCase()}`}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-primary transition-colors"
          >
            Lihat semua {primaryGenre}
            <FiChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {items.map((item, index) => (
          <motion.div
            key={item.slug}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
          >
            <Link
              href={`/donghua/${item.slug}`}
              className="block group"
            >
              {/* Poster */}
              <div className="relative aspect-poster rounded-xl overflow-hidden bg-dark-card border border-white/5 mb-2 group-hover:border-primary/50 transition-all">
                <Image
                  src={getImageUrl(item.poster)}
                  alt={item.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                />
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-dark/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                {/* Status badge */}
                {item.status && (
                  <span className={`absolute top-2 left-2 px-2 py-0.5 text-xs font-medium rounded ${
                    item.status.toLowerCase().includes('ongoing') 
                      ? 'bg-green-500/80 text-white' 
                      : 'bg-blue-500/80 text-white'
                  }`}>
                    {item.status}
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="text-sm font-medium text-gray-300 line-clamp-2 group-hover:text-white transition-colors">
                {item.title}
              </h3>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Genre Tags */}
      {genres.length > 1 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Genre terkait:</span>
          {genres.slice(0, 5).map((genre) => (
            <Link
              key={genre}
              href={`/donghua/genre/${genre.toLowerCase()}`}
              className="px-2 py-1 text-xs bg-dark-card border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-primary/50 transition-all"
            >
              {genre}
            </Link>
          ))}
        </div>
      )}
    </motion.div>
  );
}
