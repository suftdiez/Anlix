'use client';

import { useEffect, useState } from 'react';
import { HeroCarousel, SectionGrid, HeroSkeleton, CardGridSkeleton } from '@/components';
import { animeApi, donghuaApi } from '@/lib/api';
import ContinueWatching from '@/components/shared/ContinueWatching';

interface ContentItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  type?: string;
  rating?: string;
  latestEpisode?: string;
  status?: string;
  synopsis?: string;
  genres?: string[];
}

export default function HomePage() {
  const [latestAnime, setLatestAnime] = useState<ContentItem[]>([]);
  const [ongoingAnime, setOngoingAnime] = useState<ContentItem[]>([]);
  const [latestDonghua, setLatestDonghua] = useState<ContentItem[]>([]);
  const [heroItems, setHeroItems] = useState<(ContentItem & { contentType: 'anime' | 'donghua' })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [animeLatest, animeOngoing, donghuaLatest] = await Promise.all([
          animeApi.getLatest(1),
          animeApi.getOngoing(1),
          donghuaApi.getLatest(1),
        ]);

        setLatestAnime(animeLatest.data?.slice(0, 12) || []);
        setOngoingAnime(animeOngoing.data?.slice(0, 12) || []);
        setLatestDonghua(donghuaLatest.data?.slice(0, 12) || []);

        // Create hero items from latest content
        const heroes = [
          ...(animeLatest.data?.slice(0, 3).map((item: ContentItem) => ({ ...item, contentType: 'anime' as const })) || []),
          ...(donghuaLatest.data?.slice(0, 2).map((item: ContentItem) => ({ ...item, contentType: 'donghua' as const })) || []),
        ];
        setHeroItems(heroes);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      {isLoading ? (
        <HeroSkeleton />
      ) : (
        <HeroCarousel items={heroItems} />
      )}

      {/* Content Sections */}
      <div className="container mx-auto px-4">
        {/* Continue Watching - shows for logged-in users with watch history */}
        <ContinueWatching maxItems={8} />
        {/* Latest Anime */}
        {isLoading ? (
          <div className="py-8">
            <div className="skeleton h-8 w-48 mb-6" />
            <CardGridSkeleton count={12} />
          </div>
        ) : (
          <SectionGrid
            title="Anime Terbaru"
            items={latestAnime}
            viewAllHref="/anime"
            contentType="anime"
          />
        )}

        {/* Ongoing Anime */}
        {isLoading ? (
          <div className="py-8">
            <div className="skeleton h-8 w-48 mb-6" />
            <CardGridSkeleton count={12} />
          </div>
        ) : (
          <SectionGrid
            title="Anime Ongoing"
            items={ongoingAnime}
            viewAllHref="/anime?status=ongoing"
            contentType="anime"
          />
        )}

        {/* Latest Donghua */}
        {isLoading ? (
          <div className="py-8">
            <div className="skeleton h-8 w-48 mb-6" />
            <CardGridSkeleton count={12} />
          </div>
        ) : (
          <SectionGrid
            title="Donghua Terbaru"
            items={latestDonghua}
            viewAllHref="/donghua"
            contentType="donghua"
          />
        )}
      </div>
    </div>
  );
}
