'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FiChevronLeft, FiGlobe } from 'react-icons/fi';
import { AnimeCard, Pagination, CardGridSkeleton } from '@/components';
import { filmApi } from '@/lib/api';

interface FilmItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  year?: string;
  rating?: string;
  quality?: string;
}

// Country name mapping
const COUNTRY_NAMES: Record<string, { name: string; flag: string }> = {
  'south-korea': { name: 'Korea Selatan', flag: '🇰🇷' },
  'korea': { name: 'Korea Selatan', flag: '🇰🇷' },
  'japan': { name: 'Jepang', flag: '🇯🇵' },
  'united-states': { name: 'Amerika Serikat', flag: '🇺🇸' },
  'china': { name: 'China', flag: '🇨🇳' },
  'thailand': { name: 'Thailand', flag: '🇹🇭' },
  'india': { name: 'India', flag: '🇮🇳' },
  'indonesia': { name: 'Indonesia', flag: '🇮🇩' },
  'hong-kong': { name: 'Hong Kong', flag: '🇭🇰' },
  'taiwan': { name: 'Taiwan', flag: '🇹🇼' },
  'united-kingdom': { name: 'Britania Raya', flag: '🇬🇧' },
  'france': { name: 'Prancis', flag: '🇫🇷' },
  'spain': { name: 'Spanyol', flag: '🇪🇸' },
  'germany': { name: 'Jerman', flag: '🇩🇪' },
  'italy': { name: 'Italia', flag: '🇮🇹' },
  'philippines': { name: 'Filipina', flag: '🇵🇭' },
  'malaysia': { name: 'Malaysia', flag: '🇲🇾' },
  'vietnam': { name: 'Vietnam', flag: '🇻🇳' },
  'turkey': { name: 'Turki', flag: '🇹🇷' },
  'russia': { name: 'Rusia', flag: '🇷🇺' },
  'mexico': { name: 'Meksiko', flag: '🇲🇽' },
};

export default function FilmCountryPage() {
  const params = useParams();
  const countrySlug = params.country as string;
  
  const countryInfo = COUNTRY_NAMES[countrySlug] || { 
    name: countrySlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), 
    flag: '🌍' 
  };
  
  const [films, setFilms] = useState<FilmItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFilms = async () => {
      if (!countrySlug) return;

      setIsLoading(true);
      setError(null);

      try {
        const data = await filmApi.getByCountry(countrySlug, page);
        setFilms(data.data || []);
        setHasNext(data.hasNext || false);
      } catch (err) {
        console.error('Failed to fetch films by country:', err);
        setError('Gagal memuat data film');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFilms();
  }, [countrySlug, page]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/film/country"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition mb-4"
        >
          <FiChevronLeft className="w-4 h-4" />
          Kembali ke Daftar Negara
        </Link>
        
        <div className="flex items-center gap-3 mb-2">
          <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center text-3xl">
            {countryInfo.flag}
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white">
              Film <span className="gradient-text">{countryInfo.name}</span>
            </h1>
            <p className="text-gray-400">
              Koleksi film dari {countryInfo.name} subtitle Indonesia
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <CardGridSkeleton count={18} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {films.map((item, index) => (
              <AnimeCard
                key={`${item.slug}-${index}`}
                id={item.id}
                title={item.title}
                slug={item.slug}
                poster={item.poster}
                rating={item.rating}
                type={item.quality || 'HD'}
                contentType="film"
                index={index}
              />
            ))}
          </div>

          {films.length === 0 && !isLoading && !error && (
            <div className="text-center py-20 text-gray-500">
              Tidak ada film ditemukan untuk {countryInfo.name}
            </div>
          )}

          <Pagination
            currentPage={page}
            hasNext={hasNext}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        </>
      )}
    </div>
  );
}
