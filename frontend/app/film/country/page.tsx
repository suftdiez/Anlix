'use client';

import Link from 'next/link';
import { FiChevronLeft, FiGlobe, FiChevronRight } from 'react-icons/fi';

// Popular countries with their display names and slugs (matching LK21 URL)
const COUNTRIES = [
  { name: 'Korea Selatan', slug: 'south-korea', flag: '🇰🇷' },
  { name: 'Jepang', slug: 'japan', flag: '🇯🇵' },
  { name: 'Amerika Serikat', slug: 'united-states', flag: '🇺🇸' },
  { name: 'China', slug: 'china', flag: '🇨🇳' },
  { name: 'Thailand', slug: 'thailand', flag: '🇹🇭' },
  { name: 'India', slug: 'india', flag: '🇮🇳' },
  { name: 'Indonesia', slug: 'indonesia', flag: '🇮🇩' },
  { name: 'Hong Kong', slug: 'hong-kong', flag: '🇭🇰' },
  { name: 'Taiwan', slug: 'taiwan', flag: '🇹🇼' },
  { name: 'Britania Raya', slug: 'united-kingdom', flag: '🇬🇧' },
  { name: 'Prancis', slug: 'france', flag: '🇫🇷' },
  { name: 'Spanyol', slug: 'spain', flag: '🇪🇸' },
  { name: 'Jerman', slug: 'germany', flag: '🇩🇪' },
  { name: 'Italia', slug: 'italy', flag: '🇮🇹' },
  { name: 'Filipina', slug: 'philippines', flag: '🇵🇭' },
  { name: 'Malaysia', slug: 'malaysia', flag: '🇲🇾' },
  { name: 'Vietnam', slug: 'vietnam', flag: '🇻🇳' },
  { name: 'Turki', slug: 'turkey', flag: '🇹🇷' },
  { name: 'Rusia', slug: 'russia', flag: '🇷🇺' },
  { name: 'Meksiko', slug: 'mexico', flag: '🇲🇽' },
];

export default function FilmCountryIndexPage() {
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
          <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
            <FiGlobe className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white">
              Film <span className="gradient-text">Berdasarkan Negara</span>
            </h1>
            <p className="text-gray-400">
              Pilih negara untuk melihat koleksi film
            </p>
          </div>
        </div>
      </div>

      {/* Country Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {COUNTRIES.map((country) => (
          <Link
            key={country.slug}
            href={`/film/country/${country.slug}`}
            className="group relative bg-gradient-to-br from-gray-800 to-gray-900 hover:from-primary/20 hover:to-primary/10 border border-gray-700 hover:border-primary/50 rounded-xl p-5 transition-all duration-300 hover:scale-105"
          >
            <div className="text-center">
              <span className="text-4xl mb-3 block">{country.flag}</span>
              <h3 className="text-white font-semibold group-hover:text-primary transition">
                {country.name}
              </h3>
              <div className="flex items-center justify-center gap-1 mt-2 text-xs text-gray-400 group-hover:text-primary">
                <span>Lihat Film</span>
                <FiChevronRight className="w-3 h-3" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Info */}
      <div className="mt-8 p-4 bg-gray-800/50 rounded-lg">
        <p className="text-sm text-gray-400 text-center">
          Menampilkan {COUNTRIES.length} negara populer dengan koleksi film terbanyak
        </p>
      </div>
    </div>
  );
}
