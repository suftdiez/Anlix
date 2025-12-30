'use client';

import Link from 'next/link';
import { FiChevronRight } from 'react-icons/fi';
import AnimeCard from './AnimeCard';

interface ContentItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  type?: string;
  rating?: string;
  latestEpisode?: string;
  status?: string;
}

interface SectionGridProps {
  title: string;
  items: ContentItem[];
  viewAllHref?: string;
  contentType?: 'anime' | 'donghua';
  emptyMessage?: string;
}

export default function SectionGrid({
  title,
  items,
  viewAllHref,
  contentType = 'anime',
  emptyMessage = 'Tidak ada data',
}: SectionGridProps) {
  return (
    <section className="py-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-title flex items-center gap-3">
          <span className="w-1 h-8 bg-gradient-to-b from-primary to-accent rounded-full" />
          {title}
        </h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="flex items-center gap-1 text-gray-400 hover:text-primary transition-colors text-sm"
          >
            <span>Lihat Semua</span>
            <FiChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Grid */}
      {items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((item, index) => (
            <AnimeCard
              key={item.id}
              {...item}
              contentType={contentType}
              index={index}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}
