'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FiClock, FiPlay, FiChevronRight } from 'react-icons/fi';
import { donghuaApi } from '@/lib/api';
import { getImageUrl } from '@/lib/utils';

interface DonghuaItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  latestEpisode?: string;
  status?: string;
  rating?: string;
}

interface RecentlyUpdatedProps {
  maxItems?: number;
  showViewAll?: boolean;
}

export default function RecentlyUpdated({ 
  maxItems = 12, 
  showViewAll = true 
}: RecentlyUpdatedProps) {
  const [items, setItems] = useState<DonghuaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const result = await donghuaApi.getOngoing(1);
        const data = result.data || [];
        setItems(data.slice(0, maxItems));
      } catch (err) {
        console.error('Failed to fetch recently updated:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecent();
  }, [maxItems]);

  if (isLoading) {
    return (
      <div className="mb-10">
        <div className="skeleton h-8 w-48 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-poster bg-gray-700 rounded-xl mb-2" />
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-1" />
              <div className="h-3 bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-10"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-title flex items-center gap-3">
          <span className="w-1 h-8 bg-gradient-to-b from-green-400 to-emerald-600 rounded-full" />
          <FiClock className="w-5 h-5 text-green-400" />
          Baru Diupdate
        </h2>
        {showViewAll && (
          <Link
            href="/donghua?status=ongoing"
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-green-400 transition-colors"
          >
            Lihat semua
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
            transition={{ delay: index * 0.03 }}
          >
            <Link href={`/donghua/${item.slug}`} className="block group">
              {/* Poster */}
              <div className="relative aspect-poster rounded-xl overflow-hidden bg-dark-card border border-white/5 mb-2 group-hover:border-green-400/50 transition-all">
                <Image
                  src={getImageUrl(item.poster)}
                  alt={item.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-dark/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center">
                    <span className="flex items-center gap-1 px-2 py-1 bg-green-500/90 text-white text-xs font-medium rounded-lg">
                      <FiPlay className="w-3 h-3" />
                      Tonton
                    </span>
                  </div>
                </div>
                
                {/* NEW badge */}
                <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-bold bg-green-500 text-white rounded animate-pulse">
                  NEW
                </span>

                {/* Episode badge */}
                {item.latestEpisode && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium bg-dark/80 text-white rounded">
                    {item.latestEpisode}
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="text-sm font-medium text-gray-300 line-clamp-2 group-hover:text-green-400 transition-colors">
                {item.title}
              </h3>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
