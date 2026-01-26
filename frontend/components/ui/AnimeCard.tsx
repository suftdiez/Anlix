'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FiPlay, FiBookmark, FiStar } from 'react-icons/fi';
import { getImageUrl } from '@/lib/utils';

interface AnimeCardProps {
  id: string;
  title: string;
  slug: string;
  poster: string;
  type?: string;
  rating?: string;
  latestEpisode?: string;
  status?: string;
  contentType?: 'anime' | 'donghua' | 'film';
  index?: number;
}

export default function AnimeCard({
  title,
  slug,
  poster,
  type = 'TV',
  rating,
  latestEpisode,
  status,
  contentType = 'anime',
  index = 0,
}: AnimeCardProps) {
  const href = contentType === 'donghua' 
    ? `/donghua/${slug}` 
    : contentType === 'film' 
    ? `/film/${slug}` 
    : `/anime/${slug}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="anime-card"
    >
      <Link href={href} className="block relative aspect-poster overflow-hidden">
        {/* Poster Image */}
        <Image
          src={getImageUrl(poster)}
          alt={title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />

        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/20 to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-300" />

        {/* Type Badge */}
        {type && (
          <span className="absolute top-2 left-2 badge-primary text-xs z-20">
            {type}
          </span>
        )}

        {/* Status Badge */}
        {status && (
          <span className="absolute top-2 right-2 badge-accent text-xs z-20">
            {status}
          </span>
        )}

        {/* Rating */}
        {rating && (
          <div className="absolute top-10 left-2 flex items-center gap-1 text-accent text-xs z-20">
            <FiStar className="w-3 h-3 fill-current" />
            <span>{rating}</span>
          </div>
        )}

        {/* Episode Badge */}
        {latestEpisode && (
          <span className="absolute bottom-12 left-2 badge-gray text-xs z-20">
            {latestEpisode}
          </span>
        )}

        {/* Title */}
        <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
          <h3 className="text-white text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h3>
        </div>

        {/* Hover Actions */}
        <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30">
          <button className="p-3 bg-primary rounded-full text-white shadow-glow-red transform scale-90 group-hover:scale-100 transition-transform">
            <FiPlay className="w-5 h-5" />
          </button>
          <button className="p-3 bg-dark-card/80 rounded-full text-white border border-white/20 transform scale-90 group-hover:scale-100 transition-transform">
            <FiBookmark className="w-5 h-5" />
          </button>
        </div>
      </Link>
    </motion.div>
  );
}
