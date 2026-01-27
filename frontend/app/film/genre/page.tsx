'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiHome, FiGrid, FiFilm } from 'react-icons/fi';

// Film genres from LK21
const FILM_GENRES = [
  { slug: 'action', name: 'Action' },
  { slug: 'adventure', name: 'Adventure' },
  { slug: 'animation', name: 'Animation' },
  { slug: 'biography', name: 'Biography' },
  { slug: 'comedy', name: 'Comedy' },
  { slug: 'crime', name: 'Crime' },
  { slug: 'documentary', name: 'Documentary' },
  { slug: 'drama', name: 'Drama' },
  { slug: 'family', name: 'Family' },
  { slug: 'fantasy', name: 'Fantasy' },
  { slug: 'history', name: 'History' },
  { slug: 'horror', name: 'Horror' },
  { slug: 'music', name: 'Music' },
  { slug: 'mystery', name: 'Mystery' },
  { slug: 'romance', name: 'Romance' },
  { slug: 'sci-fi', name: 'Sci-Fi' },
  { slug: 'sport', name: 'Sport' },
  { slug: 'thriller', name: 'Thriller' },
  { slug: 'war', name: 'War' },
  { slug: 'western', name: 'Western' },
];

export default function FilmGenresPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-white transition-colors">
          <FiHome className="w-4 h-4" />
        </Link>
        <span>/</span>
        <Link href="/film" className="hover:text-white transition-colors">
          Film
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
          Daftar Genre Film
        </h1>
      </motion.div>

      {/* Description */}
      <p className="text-gray-400 mb-8">
        Jelajahi koleksi film berdasarkan genre favorit Anda. Pilih genre untuk melihat daftar film.
      </p>

      {/* Genre Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {FILM_GENRES.map((genre, index) => (
          <motion.div
            key={genre.slug}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
          >
            <Link
              href={`/film/genre/${genre.slug}`}
              className="flex items-center gap-3 p-4 bg-dark-card rounded-xl border border-white/5 hover:border-primary/50 hover:bg-dark-200 transition-all group"
            >
              <FiFilm className="w-5 h-5 text-primary/70 group-hover:text-primary transition-colors" />
              <span className="font-medium text-white group-hover:text-primary transition-colors">
                {genre.name}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
