'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiSearch, FiTag, FiArrowRight, FiBook } from 'react-icons/fi';
import { komikApi } from '@/lib/api';

export default function KomikGenreListPage() {
  const [genres, setGenres] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchGenres = async () => {
      setIsLoading(true);
      try {
        const response = await komikApi.getGenres();
        if (response.success) {
          setGenres(response.genres || []);
        }
      } catch (error) {
        console.error('Error fetching genres:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGenres();
  }, []);

  const filteredGenres = genres.filter(genre =>
    genre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group genres by first letter
  const groupedGenres = filteredGenres.reduce((acc, genre) => {
    const firstLetter = genre[0].toUpperCase();
    if (!acc[firstLetter]) acc[firstLetter] = [];
    acc[firstLetter].push(genre);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          Genre <span className="gradient-text">Komik</span>
        </h1>
        <p className="text-gray-400 mb-4">
          Jelajahi komik berdasarkan genre favorit kamu
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link href="/komik" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Terbaru
        </Link>
        <Link href="/komik/list" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Semua
        </Link>
        <Link href="/komik/manga" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Manga
        </Link>
        <Link href="/komik/manhwa" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Manhwa
        </Link>
        <Link href="/komik/manhua" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Manhua
        </Link>
        <Link href="/komik/genre" className="px-4 py-2 bg-primary text-white rounded-lg font-medium">
          Genre
        </Link>
      </div>

      {/* Search Genres */}
      <div className="relative mb-8">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Cari genre..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-96 pl-12 pr-4 py-3 bg-dark-card border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition"
        />
      </div>

      {/* Genres Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-20 bg-gray-800 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredGenres.length > 0 ? (
        <div className="space-y-8">
          {Object.entries(groupedGenres)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([letter, genreList]) => (
              <div key={letter}>
                <h2 className="text-lg font-bold text-primary mb-4">{letter}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {genreList.map((genre) => (
                    <Link
                      key={genre}
                      href={`/komik/genre/${encodeURIComponent(genre.toLowerCase())}`}
                      className="group relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 hover:from-primary/20 hover:to-primary/5 border border-white/5 hover:border-primary/30 transition-all duration-300"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <FiBook className="w-5 h-5 text-primary mb-2 group-hover:scale-110 transition-transform" />
                          <h3 className="font-medium text-white group-hover:text-primary transition">
                            {genre}
                          </h3>
                        </div>
                        <FiArrowRight className="w-4 h-4 text-gray-600 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <FiTag className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">
            {searchQuery ? 'Genre tidak ditemukan' : 'Tidak ada genre tersedia'}
          </p>
        </div>
      )}

      {/* Stats */}
      {!isLoading && genres.length > 0 && (
        <div className="mt-12 text-center">
          <p className="text-gray-500">
            Total {genres.length} genre tersedia
          </p>
        </div>
      )}
    </div>
  );
}
