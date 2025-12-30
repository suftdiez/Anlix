'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlay, FiChevronLeft, FiChevronRight, FiStar, FiInfo } from 'react-icons/fi';
import { getImageUrl } from '@/lib/utils';

interface HeroItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  synopsis?: string;
  rating?: string;
  type?: string;
  genres?: string[];
  contentType: 'anime' | 'donghua';
}

interface HeroCarouselProps {
  items: HeroItem[];
  autoPlayInterval?: number;
}

export default function HeroCarousel({ items, autoPlayInterval = 5000 }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (!isAutoPlaying || items.length <= 1) return;

    const interval = setInterval(goToNext, autoPlayInterval);
    return () => clearInterval(interval);
  }, [isAutoPlaying, autoPlayInterval, goToNext, items.length]);

  if (!items.length) return null;

  const currentItem = items[currentIndex];
  const href = currentItem.contentType === 'donghua' 
    ? `/donghua/${currentItem.slug}` 
    : `/anime/${currentItem.slug}`;

  return (
    <div 
      className="relative h-[70vh] md:h-[80vh] w-full overflow-hidden"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* Background Images */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
          className="absolute inset-0"
        >
          <Image
            src={getImageUrl(currentItem.poster)}
            alt={currentItem.title}
            fill
            priority
            className="object-cover"
          />
          {/* Gradient Overlays */}
          <div className="absolute inset-0 hero-overlay" />
          <div className="absolute inset-0 bg-gradient-to-t from-dark via-transparent to-dark/50" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="absolute inset-0 flex items-center">
        <div className="container mx-auto px-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl"
            >
              {/* Type Badge */}
              {currentItem.type && (
                <span className="badge-accent mb-4 inline-block">
                  {currentItem.type}
                </span>
              )}

              {/* Title */}
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-display font-bold text-white text-shadow-lg mb-4 line-clamp-2">
                {currentItem.title.length > 50 
                  ? currentItem.title.substring(0, 50) + '...'
                  : currentItem.title}
              </h1>

              {/* Rating & Genres */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                {currentItem.rating && (
                  <div className="flex items-center gap-1 text-accent">
                    <FiStar className="w-5 h-5 fill-current" />
                    <span className="font-semibold">{currentItem.rating}</span>
                  </div>
                )}
                {currentItem.genres?.slice(0, 3).map((genre) => (
                  <span key={genre} className="genre-tag">
                    {genre}
                  </span>
                ))}
              </div>

              {/* Synopsis */}
              {currentItem.synopsis && (
                <p className="text-gray-300 text-sm md:text-base line-clamp-3 mb-6">
                  {currentItem.synopsis}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-4">
                <Link href={href} className="btn-primary flex items-center gap-2">
                  <FiPlay className="w-5 h-5" />
                  <span>Tonton Sekarang</span>
                </Link>
                <Link href={href} className="btn-secondary flex items-center gap-2">
                  <FiInfo className="w-5 h-5" />
                  <span>Detail</span>
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation Buttons */}
      {items.length > 1 && (
        <>
          <button
            onClick={goToPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-dark-card/50 backdrop-blur-sm rounded-full text-white border border-white/10 hover:bg-primary/20 hover:border-primary/50 transition-all z-10"
            aria-label="Previous"
          >
            <FiChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-dark-card/50 backdrop-blur-sm rounded-full text-white border border-white/10 hover:bg-primary/20 hover:border-primary/50 transition-all z-10"
            aria-label="Next"
          >
            <FiChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {items.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
          {items.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                idx === currentIndex 
                  ? 'w-8 bg-gradient-to-r from-primary to-accent' 
                  : 'bg-white/30 hover:bg-white/50'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
