'use client';

import Link from 'next/link';
import { FiChevronLeft, FiCalendar, FiChevronRight } from 'react-icons/fi';

export default function FilmYearIndexPage() {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/film"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition mb-4"
        >
          <FiChevronLeft className="w-4 h-4" />
          Kembali ke Daftar Film
        </Link>
        
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
            <FiCalendar className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white">
              Film <span className="gradient-text">Berdasarkan Tahun</span>
            </h1>
            <p className="text-gray-400">
              Pilih tahun untuk melihat koleksi film
            </p>
          </div>
        </div>
      </div>

      {/* Year Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {years.map((year) => (
          <Link
            key={year}
            href={`/film/year/${year}`}
            className="group relative bg-gradient-to-br from-gray-800 to-gray-900 hover:from-primary/20 hover:to-primary/10 border border-gray-700 hover:border-primary/50 rounded-xl p-4 text-center transition-all duration-300 hover:scale-105"
          >
            <span className="text-2xl font-bold text-white group-hover:text-primary transition">
              {year}
            </span>
            <div className="flex items-center justify-center gap-1 mt-2 text-xs text-gray-400 group-hover:text-primary">
              <span>Lihat Film</span>
              <FiChevronRight className="w-3 h-3" />
            </div>
          </Link>
        ))}
      </div>

      {/* Info */}
      <div className="mt-8 p-4 bg-gray-800/50 rounded-lg">
        <p className="text-sm text-gray-400 text-center">
          Menampilkan film dari tahun {years[years.length - 1]} hingga {currentYear}
        </p>
      </div>
    </div>
  );
}
