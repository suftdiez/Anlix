'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FiHome, FiCalendar, FiClock } from 'react-icons/fi';
import { donghuaApi } from '@/lib/api';

interface ScheduleItem {
  title: string;
  slug: string;
  poster?: string;
  time?: string;
  episode?: string;
  url: string;
}

interface Schedule {
  [day: string]: ScheduleItem[];
}

const DAYS = [
  { key: 'monday', label: 'Senin', color: 'from-blue-500 to-cyan-500' },
  { key: 'tuesday', label: 'Selasa', color: 'from-purple-500 to-pink-500' },
  { key: 'wednesday', label: 'Rabu', color: 'from-green-500 to-emerald-500' },
  { key: 'thursday', label: 'Kamis', color: 'from-yellow-500 to-orange-500' },
  { key: 'friday', label: 'Jumat', color: 'from-red-500 to-rose-500' },
  { key: 'saturday', label: 'Sabtu', color: 'from-indigo-500 to-purple-500' },
  { key: 'sunday', label: 'Minggu', color: 'from-pink-500 to-red-500' },
];

export default function DonghuaSchedulePage() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [activeDay, setActiveDay] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get current day
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    setActiveDay(today);

    const fetchSchedule = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await donghuaApi.getSchedule();
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
          Jadwal Rilis Donghua
        </h1>
      </motion.div>
      
      <p className="text-gray-400 mb-8">
        Jadwal update episode donghua setiap hari
      </p>

      {/* Day Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {DAYS.map((day) => {
          const isActive = activeDay === day.key;
          const itemCount = schedule?.[day.key]?.length || 0;
          const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          const isToday = day.key === today;
          
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
                ({activeItems.length} donghua)
              </span>
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
                  href={`/donghua/${item.slug}`}
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
                      
                      {item.time && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                          <FiClock className="w-3 h-3" />
                          <span>{item.time}</span>
                        </div>
                      )}
                      
                      {item.episode && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-primary/20 text-primary rounded">
                          {item.episode}
                        </span>
                      )}
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
          <p className="text-gray-500">Tidak ada donghua yang dijadwalkan rilis pada hari {activeDayData?.label || activeDay}</p>
        </div>
      )}

      {/* Navigation back to Donghua */}
      <div className="mt-8 pt-8 border-t border-white/10">
        <Link
          href="/donghua"
          className="inline-flex items-center gap-2 px-4 py-2 bg-dark-card border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-primary/50 transition-all"
        >
          ← Kembali ke Daftar Donghua
        </Link>
      </div>
    </div>
  );
}
