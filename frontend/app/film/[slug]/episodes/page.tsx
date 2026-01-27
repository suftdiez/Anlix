'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { filmApi } from '@/lib/api';

interface Episode {
  season: number;
  episode: number;
  title: string;
  slug: string;
  url: string;
}

interface Season {
  number: number;
  episodeCount: number;
}

interface SeriesDetail {
  id: string;
  title: string;
  slug: string;
  poster: string;
  year?: string;
  rating?: string;
  synopsis: string;
  genres?: string[];
  isSeries: boolean;
  seasons: Season[];
  episodes: Episode[];
}

export default function SeriesEpisodesPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState(1);

  useEffect(() => {
    const fetchSeriesDetail = async () => {
      if (!slug) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await filmApi.getSeriesDetail(slug);
        if (response.success && response.data) {
          setSeries(response.data);
          // Set initial season to the first available
          if (response.data.seasons.length > 0) {
            setSelectedSeason(response.data.seasons[0].number);
          }
        } else {
          setError('Series tidak ditemukan');
        }
      } catch (err) {
        console.error('Failed to fetch series detail:', err);
        setError('Gagal memuat data series');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSeriesDetail();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-800 rounded w-3/4 mb-6" />
          <div className="flex gap-2 mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-24 bg-gray-800 rounded" />
            ))}
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-20">
          <p className="text-red-400 mb-4">{error || 'Series tidak ditemukan'}</p>
          <button
            onClick={() => router.back()}
            className="btn-primary"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  // Filter episodes by selected season
  const seasonEpisodes = series.episodes.filter(ep => ep.season === selectedSeason);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-gray-400">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/film" className="hover:text-primary">Film</Link>
        <span className="mx-2">/</span>
        <Link href={`/film/${series.slug}`} className="hover:text-primary">{series.title}</Link>
        <span className="mx-2">/</span>
        <span className="text-white">Episodes</span>
      </nav>

      {/* Series Title */}
      <h1 className="text-xl md:text-2xl font-bold text-white mb-2">
        {series.title}
        {series.year && <span className="text-gray-500 text-lg ml-2">({series.year})</span>}
      </h1>
      <p className="text-gray-400 mb-6">
        {series.seasons.length} Season • {series.episodes.length} Episode
      </p>

      {/* Season Selector */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Pilih Season:</h3>
        <div className="flex flex-wrap gap-2">
          {series.seasons.map((season) => (
            <button
              key={season.number}
              onClick={() => setSelectedSeason(season.number)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedSeason === season.number
                  ? 'bg-primary text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Season {season.number}
            </button>
          ))}
        </div>
      </div>

      {/* Episode Grid */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-white mb-4">
          Season {selectedSeason} ({seasonEpisodes.length} Episode)
        </h3>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {seasonEpisodes.map((ep) => {
            // Extract just the slug part from the URL or slug field
            const episodeSlug = ep.slug.includes('nontondrama.my') 
              ? ep.slug.split('/').pop() || ep.slug
              : ep.slug;
            return (
              <Link
                key={ep.slug}
                href={`/film/${slug}/episode/${encodeURIComponent(episodeSlug)}`}
                className="flex items-center justify-center h-12 bg-gradient-to-br from-gray-800 to-gray-900 hover:from-primary/20 hover:to-primary/10 border border-gray-700 hover:border-primary/50 rounded-lg text-white font-medium transition-all hover:scale-105"
              >
                {ep.episode}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-xl p-5 mb-8">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-2">Cara Menonton</h4>
            <ul className="text-sm text-gray-300 space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 bg-primary/20 text-primary text-xs font-bold rounded-full flex items-center justify-center">1</span>
                Pilih Season yang ingin ditonton
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 bg-primary/20 text-primary text-xs font-bold rounded-full flex items-center justify-center">2</span>
                Klik nomor Episode
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 bg-primary/20 text-primary text-xs font-bold rounded-full flex items-center justify-center">3</span>
                Pilih server streaming
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Back Link */}
      <Link
        href={`/film/${series.slug}`}
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Kembali ke Detail Series
      </Link>
    </div>
  );
}
