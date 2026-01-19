'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiHome, FiGrid } from 'react-icons/fi';

// Complete genre list from Samehadaku
const ANIME_GENRES = [
  { slug: 'action', name: 'Action' },
  { slug: 'adventure', name: 'Adventure' },
  { slug: 'comedy', name: 'Comedy' },
  { slug: 'demons', name: 'Demons' },
  { slug: 'drama', name: 'Drama' },
  { slug: 'ecchi', name: 'Ecchi' },
  { slug: 'fantasy', name: 'Fantasy' },
  { slug: 'game', name: 'Game' },
  { slug: 'harem', name: 'Harem' },
  { slug: 'historical', name: 'Historical' },
  { slug: 'horror', name: 'Horror' },
  { slug: 'isekai', name: 'Isekai' },
  { slug: 'josei', name: 'Josei' },
  { slug: 'kids', name: 'Kids' },
  { slug: 'magic', name: 'Magic' },
  { slug: 'martial-arts', name: 'Martial Arts' },
  { slug: 'mecha', name: 'Mecha' },
  { slug: 'military', name: 'Military' },
  { slug: 'music', name: 'Music' },
  { slug: 'mystery', name: 'Mystery' },
  { slug: 'parody', name: 'Parody' },
  { slug: 'police', name: 'Police' },
  { slug: 'psychological', name: 'Psychological' },
  { slug: 'romance', name: 'Romance' },
  { slug: 'samurai', name: 'Samurai' },
  { slug: 'school', name: 'School' },
  { slug: 'sci-fi', name: 'Sci-Fi' },
  { slug: 'seinen', name: 'Seinen' },
  { slug: 'shoujo', name: 'Shoujo' },
  { slug: 'shoujo-ai', name: 'Shoujo Ai' },
  { slug: 'shounen', name: 'Shounen' },
  { slug: 'shounen-ai', name: 'Shounen Ai' },
  { slug: 'slice-of-life', name: 'Slice of Life' },
  { slug: 'space', name: 'Space' },
  { slug: 'sports', name: 'Sports' },
  { slug: 'super-power', name: 'Super Power' },
  { slug: 'supernatural', name: 'Supernatural' },
  { slug: 'thriller', name: 'Thriller' },
  { slug: 'vampire', name: 'Vampire' },
];

export default function AnimeGenresPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-white transition-colors">
          <FiHome className="w-4 h-4" />
        </Link>
        <span>/</span>
        <Link href="/anime" className="hover:text-white transition-colors">
          Anime
        </Link>
        <span>/</span>
        <span className="text-primary">Genre</span>
      </nav>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-8"
      >
        <FiGrid className="w-6 h-6 text-primary" />
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white">
          Daftar Genre Anime
        </h1>
      </motion.div>

      {/* Genre Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {ANIME_GENRES.map((genre, index) => (
          <motion.div
            key={genre.slug}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
          >
            <Link
              href={`/anime/genre/${genre.slug}`}
              className="block p-4 bg-dark-card rounded-xl border border-white/5 hover:border-primary/50 hover:bg-dark-200 transition-all group text-center"
            >
              <h3 className="font-medium text-white group-hover:text-primary transition-colors">
                {genre.name}
              </h3>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
