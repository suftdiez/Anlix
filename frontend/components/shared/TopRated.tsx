'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FiStar, FiPlay, FiChevronRight } from 'react-icons/fi';
import { donghuaApi } from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import StarRating from './StarRating';

interface DonghuaItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  rating?: string;
  status?: string;
}

interface TopRatedProps {
  maxItems?: number;
  showViewAll?: boolean;
}

type Period = 'weekly' | 'monthly' | 'all';

const periodTabs: { value: Period; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'all', label: 'All' },
];

export default function TopRated({ 
  maxItems = 10, 
  showViewAll = true 
}: TopRatedProps) {
  const [items, setItems] = useState<DonghuaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activePeriod, setActivePeriod] = useState<Period>('weekly');

  useEffect(() => {
    const fetchTopRated = async () => {
      setIsLoading(true);
      try {
        const result = await donghuaApi.getPopular(activePeriod);
        const data = result.data || [];
        setItems(data.slice(0, maxItems));
      } catch (err) {
        console.error('Failed to fetch top rated:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTopRated();
  }, [maxItems, activePeriod]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-10"
    >
      {/* Section Header with Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <h2 className="section-title flex items-center gap-3">
            <span className="w-1 h-8 bg-gradient-to-b from-yellow-400 to-orange-500 rounded-full" />
            <FiStar className="w-5 h-5 text-yellow-400" />
            Top Rated
          </h2>
          
          {/* Period Tabs */}
          <div className="flex items-center gap-1 bg-dark-card rounded-lg p-1 border border-white/5">
            {periodTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActivePeriod(tab.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activePeriod === tab.value
                    ? 'bg-yellow-500 text-black'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        {showViewAll && (
          <Link
            href="/donghua?sort=rating"
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-yellow-400 transition-colors"
          >
            Lihat semua
            <FiChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-poster bg-gray-700 rounded-xl mb-2" />
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-1" />
              <div className="h-3 bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Tidak ada data untuk periode ini
        </div>
      ) : (
        /* Grid with Ranking */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map((item, index) => (
            <motion.div
              key={item.slug}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link href={`/donghua/${item.slug}`} className="block group">
                {/* Poster */}
                <div className="relative aspect-poster rounded-xl overflow-hidden bg-dark-card border border-white/5 mb-2 group-hover:border-yellow-400/50 transition-all">
                  <Image
                    src={getImageUrl(item.poster)}
                    alt={item.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  />
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-dark/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center">
                      <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/90 text-white text-xs font-medium rounded-lg">
                        <FiPlay className="w-3 h-3" />
                        Tonton
                      </span>
                    </div>
                  </div>
                  
                  {/* Ranking Badge */}
                  <div className="absolute top-0 left-0">
                    <div className={`w-8 h-8 flex items-center justify-center font-bold text-lg ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black' :
                      index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' :
                      index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-black' :
                      'bg-dark/80 text-white'
                    } rounded-br-lg`}>
                      {index + 1}
                    </div>
                  </div>

                  {/* Rating Badge with Visual Stars */}
                  {item.rating && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-sm rounded-lg">
                      <StarRating rating={parseFloat(item.rating)} size="sm" />
                    </div>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-sm font-medium text-gray-300 line-clamp-2 group-hover:text-yellow-400 transition-colors">
                  {item.title}
                </h3>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </motion.section>
  );
}
