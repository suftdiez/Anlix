'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiHome, FiGrid } from 'react-icons/fi';

// Complete genre list from Anichin
const DONGHUA_GENRES = [
  { slug: 'action', name: 'Action' },
  { slug: 'adventure', name: 'Adventure' },
  { slug: 'comedy', name: 'Comedy' },
  { slug: 'cultivation', name: 'Cultivation' },
  { slug: 'demons', name: 'Demons' },
  { slug: 'drama', name: 'Drama' },
  { slug: 'ecchi', name: 'Ecchi' },
  { slug: 'fantasy', name: 'Fantasy' },
  { slug: 'friendship', name: 'Friendship' },
  { slug: 'game', name: 'Game' },
  { slug: 'gore', name: 'Gore' },
  { slug: 'gourmet', name: 'Gourmet' },
  { slug: 'harem', name: 'Harem' },
  { slug: 'historical', name: 'Historical' },
  { slug: 'horror', name: 'Horror' },
  { slug: 'isekai', name: 'Isekai' },
  { slug: 'life', name: 'Life' },
  { slug: 'magic', name: 'Magic' },
  { slug: 'martial-arts', name: 'Martial Arts' },
  { slug: 'mecha', name: 'Mecha' },
  { slug: 'military', name: 'Military' },
  { slug: 'music', name: 'Music' },
  { slug: 'mystery', name: 'Mystery' },
  { slug: 'mythology', name: 'Mythology' },
  { slug: 'psychological', name: 'Psychological' },
  { slug: 'reincarnation', name: 'Reincarnation' },
  { slug: 'romance', name: 'Romance' },
  { slug: 'school', name: 'School' },
  { slug: 'sci-fi', name: 'Sci-Fi' },
  { slug: 'shoujo', name: 'Shoujo' },
  { slug: 'shounen', name: 'Shounen' },
  { slug: 'slice-of-life', name: 'Slice of Life' },
  { slug: 'space', name: 'Space' },
  { slug: 'sports', name: 'Sports' },
  { slug: 'super-power', name: 'Super Power' },
  { slug: 'supernatural', name: 'Supernatural' },
  { slug: 'suspense', name: 'Suspense' },
  { slug: 'thriller', name: 'Thriller' },
  { slug: 'urban-fantasy', name: 'Urban Fantasy' },
];

export default function DonghuaGenresPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-white transition-colors">
          <FiHome className="w-4 h-4" />
        </Link>
        <span>/</span>
        <Link href="/donghua" className="hover:text-white transition-colors">
          Donghua
        </Link>
        <span>/</span>
        <span className="text-accent">Genre</span>
      </nav>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-8"
      >
        <FiGrid className="w-6 h-6 text-accent" />
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white">
          Daftar Genre Donghua
        </h1>
      </motion.div>

      {/* Genre Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {DONGHUA_GENRES.map((genre, index) => (
          <motion.div
            key={genre.slug}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
          >
            <Link
              href={`/donghua/genre/${genre.slug}`}
              className="block p-4 bg-dark-card rounded-xl border border-white/5 hover:border-accent/50 hover:bg-dark-200 transition-all group text-center"
            >
              <h3 className="font-medium text-white group-hover:text-accent transition-colors">
                {genre.name}
              </h3>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
