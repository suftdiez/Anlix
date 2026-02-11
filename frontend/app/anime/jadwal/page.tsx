'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FiHome, FiCalendar, FiClock } from 'react-icons/fi';
import { animeApi } from '@/lib/api';

interface ScheduleItem {
  title: string;
  slug: string;
  poster?: string;
  url: string;
}

interface Schedule {
  [day: string]: ScheduleItem[];
}

const DAYS = [
  { key: 'Senin', label: 'Senin', color: 'from-blue-500 to-cyan-500' },
  { key: 'Selasa', label: 'Selasa', color: 'from-purple-500 to-pink-500' },
  { key: 'Rabu', label: 'Rabu', color: 'from-green-500 to-emerald-500' },
  { key: 'Kamis', label: 'Kamis', color: 'from-yellow-500 to-orange-500' },
  { key: 'Jumat', label: 'Jumat', color: 'from-red-500 to-rose-500' },
  { key: 'Sabtu', label: 'Sabtu', color: 'from-indigo-500 to-purple-500' },
  { key: 'Minggu', label: 'Minggu', color: 'from-pink-500 to-red-500' },
  { key: 'Random', label: 'Random', color: 'from-gray-500 to-gray-600' },
];

// Map JS getDay() to Indonesian day names
const DAY_INDEX_MAP: { [key: number]: string } = {
  0: 'Minggu',
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
};

export default function AnimeSchedulePage() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [activeDay, setActiveDay] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get current day in Indonesian
    const todayIndex = new Date().getDay();
    setActiveDay(DAY_INDEX_MAP[todayIndex] || 'Senin');

    const fetchSchedule = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await animeApi.getSchedule();
        setSchedule(result.data || {});
      } catch (err) {
        console.error('Failed to fetch schedule:', err);
        setError('Gagal memuat jadwal. Silakan coba lagi.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchedule();
  }, []);

  const activeDayData = DAYS.find(d => d.key === activeDay);
  const activeItems = schedule?.[activeDay] || [];
  const todayName = DAY_INDEX_MAP[new Date().getDay()];

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
        <span className="text-primary">Jadwal Rilis</span>
      </nav>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-2"
      >
        <FiCalendar className="w-6 h-6 text-primary" />
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white">
          Jadwal Rilis Anime
        </h1>
      </motion.div>
      
      <p className="text-gray-400 mb-8">
        Jadwal update episode anime ongoing setiap hari
      </p>

      {/* Day Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {DAYS.map((day) => {
          const isActive = activeDay === day.key;
          const itemCount = schedule?.[day.key]?.length || 0;
          const isToday = day.key === todayName;
          
          return (
            <button
              key={day.key}
              onClick={() => setActiveDay(day.key)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                isActive
                  ? `bg-gradient-to-r ${day.color} text-white shadow-lg`
                  : 'bg-dark-card border border-white/10 text-gray-400 hover:text-white hover:border-white/30'
              }`}
            >
              {day.label}
              {itemCount > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white/20' : 'bg-primary/20 text-primary'
                }`}>
                  {itemCount}
                </span>
              )}
              {isToday && !isActive && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Schedule Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-dark-card rounded-xl p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-16 h-20 bg-gray-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-700 rounded w-3/4" />
                  <div className="h-3 bg-gray-700 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : activeItems.length > 0 ? (
        <motion.div
          key={activeDay}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Day Header */}
          <div className={`bg-gradient-to-r ${activeDayData?.color || 'from-primary to-secondary'} p-4 rounded-xl mb-6`}>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FiCalendar className="w-5 h-5" />
              {activeDayData?.label || activeDay}
              <span className="text-sm font-normal opacity-80">
                ({activeItems.length} anime)
              </span>
              {activeDay === todayName && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-white/20 rounded-full">
                  Hari Ini
                </span>
              )}
            </h2>
          </div>

          {/* Schedule Items */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {activeItems.map((item, index) => (
              <motion.div
                key={item.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Link
                  href={`/anime/otakudesu-${item.slug}`}
                  className="block bg-dark-card rounded-xl p-4 hover:bg-dark-card/80 hover:border-primary/30 border border-white/5 transition-all group"
                >
                  <div className="flex gap-3">
                    {/* Poster */}
                    <div className="relative w-16 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
                      {item.poster ? (
                        <Image
                          src={item.poster}
                          alt={item.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform"
                          sizes="64px"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                          <FiCalendar className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white text-sm line-clamp-2 group-hover:text-primary transition-colors">
                        {item.title}
                      </h3>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      ) : (
        <div className="text-center py-20">
          <FiCalendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">Tidak ada anime yang dijadwalkan rilis pada hari {activeDayData?.label || activeDay}</p>
        </div>
      )}

      {/* Navigation back to Anime */}
      <div className="mt-8 pt-8 border-t border-white/10">
        <Link
          href="/anime"
          className="inline-flex items-center gap-2 px-4 py-2 bg-dark-card border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-primary/50 transition-all"
        >
          ← Kembali ke Daftar Anime
        </Link>
      </div>
    </div>
  );
}
